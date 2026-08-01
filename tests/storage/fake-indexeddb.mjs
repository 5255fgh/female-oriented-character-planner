function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function dispatch(target, type, properties = {}) {
  const event = new Event(type);
  for (const [key, value] of Object.entries(properties)) {
    Object.defineProperty(event, key, { value });
  }
  target.dispatchEvent(event);
}

function names(getValues) {
  return {
    contains(value) {
      return getValues().includes(value);
    },
  };
}

function readKey(value, keyPath) {
  if (Array.isArray(keyPath)) {
    return keyPath.map((segment) => value[segment]);
  }
  return value[keyPath];
}

function keysEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

class FakeRequest extends EventTarget {
  constructor(transaction = null) {
    super();
    this.result = undefined;
    this.error = null;
    this.transaction = transaction;
  }
}

class FakeIndex {
  constructor(transaction, definition, indexDefinition) {
    this.transaction = transaction;
    this.definition = definition;
    this.indexDefinition = indexDefinition;
  }

  getAll(query) {
    return this.transaction.request(() => {
      const matches = [];
      for (const value of this.definition.records.values()) {
        if (keysEqual(readKey(value, this.indexDefinition.keyPath), query)) {
          matches.push(clone(value));
        }
      }
      return matches;
    });
  }

  getAllKeys(query) {
    return this.transaction.request(() => {
      const matches = [];
      for (const [primaryKey, value] of this.definition.records) {
        if (keysEqual(readKey(value, this.indexDefinition.keyPath), query)) {
          matches.push(clone(primaryKey));
        }
      }
      return matches;
    });
  }
}

class FakeObjectStore {
  constructor(transaction, definition) {
    this.transaction = transaction;
    this.definition = definition;
    this.indexNames = names(() => [...this.definition.indexes.keys()]);
  }

  createIndex(name, keyPath, options = {}) {
    if (this.definition.indexes.has(name)) {
      throw new Error(`Index ${name} already exists`);
    }
    this.definition.indexes.set(name, {
      keyPath: clone(keyPath),
      unique: Boolean(options.unique),
    });
    return this.index(name);
  }

  index(name) {
    const indexDefinition = this.definition.indexes.get(name);
    if (!indexDefinition) {
      throw new Error(`Index ${name} does not exist`);
    }
    return new FakeIndex(this.transaction, this.definition, indexDefinition);
  }

  add(value) {
    return this.transaction.request(() => {
      const record = clone(value);
      const key = readKey(record, this.definition.keyPath);
      if (this.definition.records.has(key)) {
        throw new Error(`Key ${key} already exists`);
      }
      this.definition.records.set(key, record);
      return key;
    });
  }

  put(value) {
    return this.transaction.request(() => {
      const record = clone(value);
      const key = readKey(record, this.definition.keyPath);
      if (key === undefined) {
        throw new Error("Record key is missing");
      }
      this.definition.records.set(key, record);
      return key;
    });
  }

  delete(key) {
    return this.transaction.request(() => {
      this.definition.records.delete(key);
      return undefined;
    });
  }

  get(key) {
    return this.transaction.request(() => clone(this.definition.records.get(key)));
  }

  getAll() {
    return this.transaction.request(() =>
      [...this.definition.records.values()].map((value) => clone(value)),
    );
  }
}

class FakeTransaction extends EventTarget {
  constructor(database, storeNames, mode) {
    super();
    this.database = database;
    this.storeNames = new Set(storeNames);
    this.mode = mode;
    this.error = null;
    this.pending = 0;
    this.started = false;
    this.aborted = false;
    this.completed = false;
    this.completionScheduled = false;
  }

  objectStore(name) {
    if (this.mode !== "versionchange" && !this.storeNames.has(name)) {
      throw new Error(`Object Store ${name} is outside this transaction`);
    }
    const definition = this.database.state.stores.get(name);
    if (!definition) {
      throw new Error(`Object Store ${name} does not exist`);
    }
    return new FakeObjectStore(this, definition);
  }

  request(operation) {
    if (this.aborted || this.completed) {
      throw new Error("Transaction is inactive");
    }
    this.started = true;
    this.pending += 1;
    const request = new FakeRequest(this);
    queueMicrotask(() => {
      if (this.aborted) {
        return;
      }
      try {
        request.result = operation();
        dispatch(request, "success");
      } catch (error) {
        request.error = error;
        this.error = error;
        dispatch(request, "error");
        dispatch(this, "error");
        this.abort();
        return;
      }
      this.pending -= 1;
      this.scheduleCompletion();
    });
    return request;
  }

  markUpgradeHandlerComplete() {
    this.started = true;
    this.scheduleCompletion();
  }

  scheduleCompletion() {
    if (
      !this.started ||
      this.pending !== 0 ||
      this.aborted ||
      this.completed ||
      this.completionScheduled
    ) {
      return;
    }
    this.completionScheduled = true;
    queueMicrotask(() => {
      this.completionScheduled = false;
      if (this.pending === 0 && !this.aborted && !this.completed) {
        this.completed = true;
        dispatch(this, "complete");
      }
    });
  }

  abort() {
    if (this.aborted || this.completed) {
      return;
    }
    this.aborted = true;
    this.error ??= new Error("Transaction aborted");
    queueMicrotask(() => dispatch(this, "abort"));
  }
}

class FakeDatabase extends EventTarget {
  constructor(state) {
    super();
    this.state = state;
    this.closed = false;
    this.upgradeTransaction = null;
    this.objectStoreNames = names(() => [...this.state.stores.keys()]);
  }

  get version() {
    return this.state.version;
  }

  createObjectStore(name, options = {}) {
    if (!this.upgradeTransaction) {
      throw new Error("Object Stores can only be created during upgrade");
    }
    if (this.state.stores.has(name)) {
      throw new Error(`Object Store ${name} already exists`);
    }
    const definition = {
      keyPath: options.keyPath,
      records: new Map(),
      indexes: new Map(),
    };
    this.state.stores.set(name, definition);
    return new FakeObjectStore(this.upgradeTransaction, definition);
  }

  transaction(storeNames, mode = "readonly") {
    const selected = Array.isArray(storeNames) ? storeNames : [storeNames];
    return new FakeTransaction(this, selected, mode);
  }

  close() {
    this.closed = true;
  }
}

function cloneState(source, version) {
  const state = { version, stores: new Map() };
  if (!source) {
    return state;
  }
  for (const [name, definition] of source.stores) {
    state.stores.set(name, {
      keyPath: clone(definition.keyPath),
      records: new Map(
        [...definition.records].map(([key, value]) => [clone(key), clone(value)]),
      ),
      indexes: new Map(
        [...definition.indexes].map(([key, value]) => [key, clone(value)]),
      ),
    });
  }
  return state;
}

export function createFakeIndexedDB() {
  const databases = new Map();

  return {
    open(name, requestedVersion) {
      const request = new FakeRequest();
      queueMicrotask(() => {
        const current = databases.get(name);
        const oldVersion = current?.version ?? 0;
        const version = requestedVersion ?? (oldVersion || 1);
        if (version < oldVersion) {
          request.error = new Error("Version is lower than the stored version");
          dispatch(request, "error");
          return;
        }

        if (version === oldVersion && current) {
          request.result = new FakeDatabase(current);
          dispatch(request, "success");
          return;
        }

        const draft = cloneState(current, version);
        const database = new FakeDatabase(draft);
        const transaction = new FakeTransaction(
          database,
          [...draft.stores.keys()],
          "versionchange",
        );
        database.upgradeTransaction = transaction;
        request.result = database;
        request.transaction = transaction;

        transaction.addEventListener(
          "complete",
          () => {
            database.upgradeTransaction = null;
            databases.set(name, draft);
            request.transaction = null;
            dispatch(request, "success");
          },
          { once: true },
        );
        transaction.addEventListener(
          "abort",
          () => {
            database.upgradeTransaction = null;
            request.error = transaction.error;
            request.transaction = null;
            dispatch(request, "error");
          },
          { once: true },
        );

        dispatch(request, "upgradeneeded", {
          oldVersion,
          newVersion: version,
        });
        transaction.markUpgradeHandlerComplete();
      });
      return request;
    },
  };
}

export function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error), { once: true });
  });
}

export function transactionResult(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", resolve, { once: true });
    transaction.addEventListener(
      "abort",
      () => reject(transaction.error),
      { once: true },
    );
    transaction.addEventListener(
      "error",
      () => reject(transaction.error),
      { once: true },
    );
  });
}
