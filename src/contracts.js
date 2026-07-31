/**
 * @typedef {"free_character" | "dead_rival" | "image_shape"} OutputMode
 */

/**
 * @typedef {"low" | "medium" | "high"} InitiativeLevel
 */

/**
 * @typedef {object} CreativeBrief
 * @property {"maoxiang"} platform
 * @property {OutputMode} outputMode
 * @property {string} characterGender
 * @property {string} ageRange
 * @property {string} worldSetting
 * @property {string} characterIdentity
 * @property {string[]} coreExperiences
 * @property {string} relationshipType
 * @property {string} coreConflict
 * @property {string} personalityContradiction
 * @property {InitiativeLevel} initiativeLevel
 * @property {string[]} interactionTone
 * @property {string[]} boundaries
 * @property {string[]} bannedBehaviors
 * @property {string} extraNotes
 */

/**
 * @typedef {object} ConceptCandidate
 * @property {string} id
 * @property {string} name
 * @property {string} oneLiner
 * @property {string} coreExperience
 * @property {string} initialRelation
 * @property {string} coreConflict
 * @property {string} uniqueBehavior
 * @property {string} firstInteraction
 * @property {string} longTermPotential
 * @property {string} differenceSummary
 */

/**
 * @typedef {object} CharacterMeta
 * @property {string} id
 * @property {string} name
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {object} CharacterPublicInfo
 * @property {string} name
 * @property {string} oneLiner
 * @property {string} appearance
 * @property {string[]} tags
 */

/**
 * @typedef {object} CharacterPersona
 * @property {string} identity
 * @property {string} background
 * @property {string} currentGoal
 * @property {string} secret
 * @property {string} desire
 * @property {string} fear
 * @property {string} contradiction
 * @property {string[]} concreteBehaviors
 * @property {string[]} initiativeRules
 * @property {string[]} forbiddenBehaviors
 */

/**
 * @typedef {object} RelationshipStage
 * @property {string} name
 * @property {string} trigger
 * @property {string} behavior
 */

/**
 * @typedef {object} CharacterRelationship
 * @property {string} initialRelation
 * @property {string[]} attractionConditions
 * @property {RelationshipStage[]} stages
 * @property {string} conflictPattern
 * @property {string} repairPattern
 */

/**
 * @typedef {object} DialogueExample
 * @property {string} user
 * @property {string} character
 */

/**
 * @typedef {object} CharacterDialogueStyle
 * @property {string} addressStyle
 * @property {string} sentenceStyle
 * @property {string} replyLength
 * @property {string} actionNarration
 * @property {string} emotionalExpression
 * @property {string[]} bannedPhrases
 * @property {DialogueExample[]} examples
 */

/**
 * @typedef {object} CharacterOpenings
 * @property {string} plotOpening
 * @property {string} dailyOpening
 * @property {string} tensionOpening
 */

/**
 * @typedef {object} CharacterImageDesign
 * @property {string} appearancePrompt
 * @property {string} styleSuggestion
 */

/**
 * @typedef {object} CharacterDraft
 * @property {CharacterMeta} meta
 * @property {CharacterPublicInfo} publicInfo
 * @property {CharacterPersona} persona
 * @property {CharacterRelationship} relationship
 * @property {CharacterDialogueStyle} dialogueStyle
 * @property {CharacterOpenings} openings
 * @property {CharacterImageDesign} imageDesign
 */

/**
 * @typedef {null | boolean | number | string | JsonValue[] | {[key: string]: JsonValue}} JsonValue
 */

/**
 * @typedef {object} FieldPatch
 * @property {string} fieldPath
 * @property {JsonValue} value
 */

/**
 * @typedef {"pass" | "warning" | "fail"} ReportStatus
 */

/**
 * @typedef {object} RuleCheckIssue
 * @property {string} code
 * @property {"warning" | "error"} severity
 * @property {string} fieldPath
 * @property {string} message
 * @property {string} evidence
 * @property {string} suggestedAction
 */

/**
 * @typedef {object} RuleCheckReport
 * @property {ReportStatus} status
 * @property {RuleCheckIssue[]} issues
 */

/**
 * @typedef {object} SimulationScenario
 * @property {string} scenarioId
 * @property {string} userInput
 * @property {string} characterResponse
 * @property {string[]} issues
 * @property {string[]} evidence
 * @property {string[]} suggestedFields
 */

/**
 * @typedef {object} SimulationReport
 * @property {ReportStatus} status
 * @property {SimulationScenario[]} scenarios
 * @property {string} summary
 */

/**
 * @typedef {object} PlatformBlock
 * @property {string} id
 * @property {string} label
 * @property {string} text
 * @property {number | null} maxLength
 * @property {number} currentLength
 * @property {boolean} valid
 * @property {boolean} verified
 */

/**
 * @typedef {object} PlatformPack
 * @property {"maoxiang"} platform
 * @property {string} flowId
 * @property {PlatformBlock[]} blocks
 * @property {string} generatedAt
 */

/**
 * @typedef {object} CharacterProject
 * @property {string} id
 * @property {string} title
 * @property {CreativeBrief} brief
 * @property {ConceptCandidate[]} concepts
 * @property {string} selectedConceptId
 * @property {CharacterDraft} character
 * @property {RuleCheckReport} ruleReport
 * @property {SimulationReport} simulationReport
 * @property {PlatformPack[]} platformPacks
 * @property {string} createdAt
 * @property {string} updatedAt
 */

const CREATIVE_BRIEF_KEYS = [
  "platform",
  "outputMode",
  "characterGender",
  "ageRange",
  "worldSetting",
  "characterIdentity",
  "coreExperiences",
  "relationshipType",
  "coreConflict",
  "personalityContradiction",
  "initiativeLevel",
  "interactionTone",
  "boundaries",
  "bannedBehaviors",
  "extraNotes",
];

const CONCEPT_CANDIDATE_KEYS = [
  "id",
  "name",
  "oneLiner",
  "coreExperience",
  "initialRelation",
  "coreConflict",
  "uniqueBehavior",
  "firstInteraction",
  "longTermPotential",
  "differenceSummary",
];

const CHARACTER_DRAFT_KEYS = [
  "meta",
  "publicInfo",
  "persona",
  "relationship",
  "dialogueStyle",
  "openings",
  "imageDesign",
];

const REPORT_STATUSES = ["pass", "warning", "fail"];
const BLOCKED_PATH_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);
const PLATFORM_FLOW_IDS = [
  "free_character",
  "dead_rival",
  "image_shape",
  "open_story",
];

/**
 * @param {string} path
 * @param {string} message
 * @returns {never}
 */
function fail(path, message) {
  throw new Error(`${path}: ${message}`);
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * @param {unknown} value
 * @param {string} path
 * @returns {Record<string, unknown>}
 */
function assertObject(value, path) {
  if (!isPlainObject(value)) {
    fail(path, "expected an object");
  }
  return value;
}

/**
 * @param {Record<string, unknown>} value
 * @param {string[]} expectedKeys
 * @param {string} path
 */
function assertExactKeys(value, expectedKeys, path) {
  const expected = new Set(expectedKeys);
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) {
      fail(`${path}.${key}`, "unexpected field");
    }
  }
}

/**
 * @param {unknown} value
 * @param {string} path
 * @returns {string}
 */
function assertString(value, path) {
  if (typeof value !== "string") {
    fail(path, "expected a string");
  }
  return value;
}

/**
 * @param {unknown} value
 * @param {string} path
 * @returns {boolean}
 */
function assertBoolean(value, path) {
  if (typeof value !== "boolean") {
    fail(path, "expected a boolean");
  }
  return value;
}

/**
 * @param {unknown} value
 * @param {string} path
 * @returns {number}
 */
function assertNumber(value, path) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(path, "expected a finite number");
  }
  return value;
}

/**
 * @param {unknown} value
 * @param {readonly string[]} allowedValues
 * @param {string} path
 * @returns {string}
 */
function assertEnum(value, allowedValues, path) {
  const stringValue = assertString(value, path);
  if (!allowedValues.includes(stringValue)) {
    fail(path, `expected one of: ${allowedValues.join(", ")}`);
  }
  return stringValue;
}

/**
 * @param {unknown} value
 * @param {string} path
 * @returns {unknown[]}
 */
function assertArray(value, path) {
  if (!Array.isArray(value)) {
    fail(path, "expected an array");
  }
  return value;
}

/**
 * @param {unknown} value
 * @param {string} path
 * @returns {string[]}
 */
function assertStringArray(value, path) {
  const array = assertArray(value, path);
  for (let index = 0; index < array.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(array, index)) {
      fail(`${path}[${index}]`, "missing array item");
    }
    assertString(array[index], `${path}[${index}]`);
  }
  return /** @type {string[]} */ (array);
}

/**
 * @param {unknown} value
 * @param {string} path
 * @param {Set<object>} [ancestors]
 */
function assertJsonValue(value, path, ancestors = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      fail(path, "expected a JSON-serializable finite number");
    }
    return;
  }

  if (typeof value !== "object") {
    fail(path, "expected a JSON-serializable value");
  }

  if (ancestors.has(value)) {
    fail(path, "expected a JSON-serializable value without circular references");
  }

  ancestors.add(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) {
        fail(`${path}[${index}]`, "sparse arrays are not supported");
      }
      assertJsonValue(value[index], `${path}[${index}]`, ancestors);
    }
  } else {
    const objectValue = assertObject(value, path);
    for (const key of Object.keys(objectValue)) {
      assertJsonValue(objectValue[key], `${path}.${key}`, ancestors);
    }
  }
  ancestors.delete(value);
}

/**
 * @param {JsonValue} value
 * @returns {JsonValue}
 */
function cloneJsonValue(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneJsonValue(item));
  }

  /** @type {{[key: string]: JsonValue}} */
  const clone = {};
  for (const [key, childValue] of Object.entries(value)) {
    Object.defineProperty(clone, key, {
      value: cloneJsonValue(childValue),
      configurable: true,
      enumerable: true,
      writable: true,
    });
  }
  return clone;
}

/**
 * @param {unknown} value
 * @param {string} path
 */
function validateCreativeBrief(value, path) {
  const brief = assertObject(value, path);
  assertExactKeys(brief, CREATIVE_BRIEF_KEYS, path);
  assertEnum(brief.platform, ["maoxiang"], `${path}.platform`);
  assertEnum(
    brief.outputMode,
    ["free_character", "dead_rival", "image_shape"],
    `${path}.outputMode`,
  );
  assertString(brief.characterGender, `${path}.characterGender`);
  assertString(brief.ageRange, `${path}.ageRange`);
  assertString(brief.worldSetting, `${path}.worldSetting`);
  assertString(brief.characterIdentity, `${path}.characterIdentity`);
  assertStringArray(brief.coreExperiences, `${path}.coreExperiences`);
  assertString(brief.relationshipType, `${path}.relationshipType`);
  assertString(brief.coreConflict, `${path}.coreConflict`);
  assertString(brief.personalityContradiction, `${path}.personalityContradiction`);
  assertEnum(brief.initiativeLevel, ["low", "medium", "high"], `${path}.initiativeLevel`);
  assertStringArray(brief.interactionTone, `${path}.interactionTone`);
  assertStringArray(brief.boundaries, `${path}.boundaries`);
  assertStringArray(brief.bannedBehaviors, `${path}.bannedBehaviors`);
  assertString(brief.extraNotes, `${path}.extraNotes`);
}

/**
 * @param {unknown} value
 * @param {string} path
 */
function validateConceptCandidate(value, path) {
  const candidate = assertObject(value, path);
  assertExactKeys(candidate, CONCEPT_CANDIDATE_KEYS, path);
  for (const key of CONCEPT_CANDIDATE_KEYS) {
    assertString(candidate[key], `${path}.${key}`);
  }
}

/**
 * @param {unknown} value
 * @param {string} path
 */
function validateConceptCandidates(value, path) {
  const candidates = assertArray(value, path);
  if (candidates.length !== 3) {
    fail(path, "expected exactly 3 concept candidates");
  }

  const ids = new Set();
  for (let index = 0; index < candidates.length; index += 1) {
    validateConceptCandidate(candidates[index], `${path}[${index}]`);
    const candidate = /** @type {Record<string, unknown>} */ (candidates[index]);
    if (ids.has(candidate.id)) {
      fail(`${path}[${index}].id`, "expected a unique candidate id");
    }
    ids.add(candidate.id);
  }
}

/**
 * @param {unknown} value
 * @param {string} path
 */
function validateCharacterDraft(value, path) {
  const character = assertObject(value, path);
  assertExactKeys(character, CHARACTER_DRAFT_KEYS, path);

  const meta = assertObject(character.meta, `${path}.meta`);
  assertExactKeys(meta, ["id", "name", "createdAt", "updatedAt"], `${path}.meta`);
  assertString(meta.id, `${path}.meta.id`);
  assertString(meta.name, `${path}.meta.name`);
  assertString(meta.createdAt, `${path}.meta.createdAt`);
  assertString(meta.updatedAt, `${path}.meta.updatedAt`);

  const publicInfo = assertObject(character.publicInfo, `${path}.publicInfo`);
  assertExactKeys(publicInfo, ["name", "oneLiner", "appearance", "tags"], `${path}.publicInfo`);
  assertString(publicInfo.name, `${path}.publicInfo.name`);
  assertString(publicInfo.oneLiner, `${path}.publicInfo.oneLiner`);
  assertString(publicInfo.appearance, `${path}.publicInfo.appearance`);
  assertStringArray(publicInfo.tags, `${path}.publicInfo.tags`);

  const persona = assertObject(character.persona, `${path}.persona`);
  assertExactKeys(
    persona,
    [
      "identity",
      "background",
      "currentGoal",
      "secret",
      "desire",
      "fear",
      "contradiction",
      "concreteBehaviors",
      "initiativeRules",
      "forbiddenBehaviors",
    ],
    `${path}.persona`,
  );
  for (const key of [
    "identity",
    "background",
    "currentGoal",
    "secret",
    "desire",
    "fear",
    "contradiction",
  ]) {
    assertString(persona[key], `${path}.persona.${key}`);
  }
  assertStringArray(persona.concreteBehaviors, `${path}.persona.concreteBehaviors`);
  assertStringArray(persona.initiativeRules, `${path}.persona.initiativeRules`);
  assertStringArray(persona.forbiddenBehaviors, `${path}.persona.forbiddenBehaviors`);

  const relationship = assertObject(character.relationship, `${path}.relationship`);
  assertExactKeys(
    relationship,
    ["initialRelation", "attractionConditions", "stages", "conflictPattern", "repairPattern"],
    `${path}.relationship`,
  );
  assertString(relationship.initialRelation, `${path}.relationship.initialRelation`);
  assertStringArray(relationship.attractionConditions, `${path}.relationship.attractionConditions`);
  const stages = assertArray(relationship.stages, `${path}.relationship.stages`);
  for (let index = 0; index < stages.length; index += 1) {
    const stagePath = `${path}.relationship.stages[${index}]`;
    const stage = assertObject(stages[index], stagePath);
    assertExactKeys(stage, ["name", "trigger", "behavior"], stagePath);
    assertString(stage.name, `${stagePath}.name`);
    assertString(stage.trigger, `${stagePath}.trigger`);
    assertString(stage.behavior, `${stagePath}.behavior`);
  }
  assertString(relationship.conflictPattern, `${path}.relationship.conflictPattern`);
  assertString(relationship.repairPattern, `${path}.relationship.repairPattern`);

  const dialogueStyle = assertObject(character.dialogueStyle, `${path}.dialogueStyle`);
  assertExactKeys(
    dialogueStyle,
    [
      "addressStyle",
      "sentenceStyle",
      "replyLength",
      "actionNarration",
      "emotionalExpression",
      "bannedPhrases",
      "examples",
    ],
    `${path}.dialogueStyle`,
  );
  assertString(dialogueStyle.addressStyle, `${path}.dialogueStyle.addressStyle`);
  assertString(dialogueStyle.sentenceStyle, `${path}.dialogueStyle.sentenceStyle`);
  assertString(dialogueStyle.replyLength, `${path}.dialogueStyle.replyLength`);
  assertString(dialogueStyle.actionNarration, `${path}.dialogueStyle.actionNarration`);
  assertString(dialogueStyle.emotionalExpression, `${path}.dialogueStyle.emotionalExpression`);
  assertStringArray(dialogueStyle.bannedPhrases, `${path}.dialogueStyle.bannedPhrases`);
  const examples = assertArray(dialogueStyle.examples, `${path}.dialogueStyle.examples`);
  for (let index = 0; index < examples.length; index += 1) {
    const examplePath = `${path}.dialogueStyle.examples[${index}]`;
    const example = assertObject(examples[index], examplePath);
    assertExactKeys(example, ["user", "character"], examplePath);
    assertString(example.user, `${examplePath}.user`);
    assertString(example.character, `${examplePath}.character`);
  }

  const openings = assertObject(character.openings, `${path}.openings`);
  assertExactKeys(openings, ["plotOpening", "dailyOpening", "tensionOpening"], `${path}.openings`);
  assertString(openings.plotOpening, `${path}.openings.plotOpening`);
  assertString(openings.dailyOpening, `${path}.openings.dailyOpening`);
  assertString(openings.tensionOpening, `${path}.openings.tensionOpening`);

  const imageDesign = assertObject(character.imageDesign, `${path}.imageDesign`);
  assertExactKeys(imageDesign, ["appearancePrompt", "styleSuggestion"], `${path}.imageDesign`);
  assertString(imageDesign.appearancePrompt, `${path}.imageDesign.appearancePrompt`);
  assertString(imageDesign.styleSuggestion, `${path}.imageDesign.styleSuggestion`);
}

/**
 * @param {unknown} value
 * @param {string} path
 */
function validateRuleCheckReport(value, path) {
  const report = assertObject(value, path);
  assertExactKeys(report, ["status", "issues"], path);
  assertEnum(report.status, REPORT_STATUSES, `${path}.status`);
  const issues = assertArray(report.issues, `${path}.issues`);
  for (let index = 0; index < issues.length; index += 1) {
    const issuePath = `${path}.issues[${index}]`;
    const issue = assertObject(issues[index], issuePath);
    assertExactKeys(
      issue,
      ["code", "severity", "fieldPath", "message", "evidence", "suggestedAction"],
      issuePath,
    );
    assertString(issue.code, `${issuePath}.code`);
    assertEnum(issue.severity, ["warning", "error"], `${issuePath}.severity`);
    assertString(issue.fieldPath, `${issuePath}.fieldPath`);
    assertString(issue.message, `${issuePath}.message`);
    assertString(issue.evidence, `${issuePath}.evidence`);
    assertString(issue.suggestedAction, `${issuePath}.suggestedAction`);
  }
}

/**
 * @param {unknown} value
 * @param {string} path
 */
function validateSimulationReport(value, path) {
  const report = assertObject(value, path);
  assertExactKeys(report, ["status", "scenarios", "summary"], path);
  assertEnum(report.status, REPORT_STATUSES, `${path}.status`);
  const scenarios = assertArray(report.scenarios, `${path}.scenarios`);
  if (scenarios.length !== 8) {
    fail(`${path}.scenarios`, "expected exactly 8 scenarios");
  }

  const scenarioIds = new Set();
  for (let index = 0; index < scenarios.length; index += 1) {
    const scenarioPath = `${path}.scenarios[${index}]`;
    const scenario = assertObject(scenarios[index], scenarioPath);
    assertExactKeys(
      scenario,
      ["scenarioId", "userInput", "characterResponse", "issues", "evidence", "suggestedFields"],
      scenarioPath,
    );
    assertString(scenario.scenarioId, `${scenarioPath}.scenarioId`);
    assertString(scenario.userInput, `${scenarioPath}.userInput`);
    assertString(scenario.characterResponse, `${scenarioPath}.characterResponse`);
    assertStringArray(scenario.issues, `${scenarioPath}.issues`);
    assertStringArray(scenario.evidence, `${scenarioPath}.evidence`);
    assertStringArray(scenario.suggestedFields, `${scenarioPath}.suggestedFields`);
    if (scenarioIds.has(scenario.scenarioId)) {
      fail(`${scenarioPath}.scenarioId`, "expected a unique scenario id");
    }
    scenarioIds.add(scenario.scenarioId);
  }
  assertString(report.summary, `${path}.summary`);
}

/**
 * @param {unknown} value
 * @param {string} path
 */
function validatePlatformPack(value, path) {
  const pack = assertObject(value, path);
  assertExactKeys(pack, ["platform", "flowId", "blocks", "generatedAt"], path);
  assertEnum(pack.platform, ["maoxiang"], `${path}.platform`);
  assertEnum(pack.flowId, PLATFORM_FLOW_IDS, `${path}.flowId`);

  const blocks = assertArray(pack.blocks, `${path}.blocks`);
  const blockIds = new Set();
  for (let index = 0; index < blocks.length; index += 1) {
    const blockPath = `${path}.blocks[${index}]`;
    const block = assertObject(blocks[index], blockPath);
    assertExactKeys(
      block,
      ["id", "label", "text", "maxLength", "currentLength", "valid", "verified"],
      blockPath,
    );
    assertString(block.id, `${blockPath}.id`);
    assertString(block.label, `${blockPath}.label`);
    const text = assertString(block.text, `${blockPath}.text`);
    if (block.maxLength !== null) {
      const maxLength = assertNumber(block.maxLength, `${blockPath}.maxLength`);
      if (maxLength < 0) {
        fail(`${blockPath}.maxLength`, "expected a non-negative number or null");
      }
    }
    const currentLength = assertNumber(block.currentLength, `${blockPath}.currentLength`);
    if (currentLength < 0) {
      fail(`${blockPath}.currentLength`, "expected a non-negative number");
    }
    const measuredLength = Array.from(text).length;
    if (currentLength !== measuredLength) {
      fail(
        `${blockPath}.currentLength`,
        `expected ${measuredLength} to match the Unicode character count of ${blockPath}.text`,
      );
    }
    assertBoolean(block.valid, `${blockPath}.valid`);
    assertBoolean(block.verified, `${blockPath}.verified`);
    if (
      typeof block.maxLength === "number" &&
      currentLength > block.maxLength &&
      block.valid
    ) {
      fail(`${blockPath}.valid`, "expected false when currentLength exceeds maxLength");
    }
    if (blockIds.has(block.id)) {
      fail(`${blockPath}.id`, "expected a unique block id");
    }
    blockIds.add(block.id);
  }
  assertString(pack.generatedAt, `${path}.generatedAt`);
}

/**
 * @param {unknown} value
 * @returns {CreativeBrief}
 */
export function assertCreativeBrief(value) {
  validateCreativeBrief(value, "CreativeBrief");
  return /** @type {CreativeBrief} */ (value);
}

/**
 * @param {unknown} value
 * @returns {ConceptCandidate[]}
 */
export function assertConceptCandidates(value) {
  validateConceptCandidates(value, "ConceptCandidates");
  return /** @type {ConceptCandidate[]} */ (value);
}

/**
 * @param {unknown} value
 * @returns {CharacterDraft}
 */
export function assertCharacterDraft(value) {
  validateCharacterDraft(value, "CharacterDraft");
  return /** @type {CharacterDraft} */ (value);
}

/**
 * @param {unknown} value
 * @returns {FieldPatch}
 */
export function assertFieldPatch(value) {
  const patch = assertObject(value, "FieldPatch");
  assertExactKeys(patch, ["fieldPath", "value"], "FieldPatch");
  const fieldPath = assertString(patch.fieldPath, "FieldPatch.fieldPath");
  parseFieldPath(fieldPath, "FieldPatch.fieldPath");
  assertJsonValue(patch.value, "FieldPatch.value");
  return /** @type {FieldPatch} */ (value);
}

/**
 * @param {unknown} value
 * @returns {RuleCheckReport}
 */
export function assertRuleCheckReport(value) {
  validateRuleCheckReport(value, "RuleCheckReport");
  return /** @type {RuleCheckReport} */ (value);
}

/**
 * @param {unknown} value
 * @returns {SimulationReport}
 */
export function assertSimulationReport(value) {
  validateSimulationReport(value, "SimulationReport");
  return /** @type {SimulationReport} */ (value);
}

/**
 * @param {unknown} value
 * @returns {PlatformPack}
 */
export function assertPlatformPack(value) {
  validatePlatformPack(value, "PlatformPack");
  return /** @type {PlatformPack} */ (value);
}

/**
 * @param {unknown} value
 * @returns {CharacterProject}
 */
export function assertCharacterProject(value) {
  const project = assertObject(value, "CharacterProject");
  assertExactKeys(
    project,
    [
      "id",
      "title",
      "brief",
      "concepts",
      "selectedConceptId",
      "character",
      "ruleReport",
      "simulationReport",
      "platformPacks",
      "createdAt",
      "updatedAt",
    ],
    "CharacterProject",
  );
  assertString(project.id, "CharacterProject.id");
  assertString(project.title, "CharacterProject.title");
  validateCreativeBrief(project.brief, "CharacterProject.brief");
  validateConceptCandidates(project.concepts, "CharacterProject.concepts");
  const selectedConceptId = assertString(
    project.selectedConceptId,
    "CharacterProject.selectedConceptId",
  );
  const concepts = /** @type {ConceptCandidate[]} */ (project.concepts);
  if (!concepts.some((candidate) => candidate.id === selectedConceptId)) {
    fail("CharacterProject.selectedConceptId", "expected an id present in CharacterProject.concepts");
  }
  validateCharacterDraft(project.character, "CharacterProject.character");
  validateRuleCheckReport(project.ruleReport, "CharacterProject.ruleReport");
  validateSimulationReport(project.simulationReport, "CharacterProject.simulationReport");
  const platformPacks = assertArray(project.platformPacks, "CharacterProject.platformPacks");
  for (let index = 0; index < platformPacks.length; index += 1) {
    validatePlatformPack(platformPacks[index], `CharacterProject.platformPacks[${index}]`);
  }
  assertString(project.createdAt, "CharacterProject.createdAt");
  assertString(project.updatedAt, "CharacterProject.updatedAt");
  return /** @type {CharacterProject} */ (value);
}

/**
 * @param {string} fieldPath
 * @param {string} errorPath
 * @returns {string[]}
 */
function parseFieldPath(fieldPath, errorPath) {
  if (fieldPath.length === 0) {
    fail(errorPath, "field path must not be empty");
  }

  const validPathPattern = /^[A-Za-z_$][A-Za-z0-9_$-]*(?:\.[A-Za-z0-9_$-]+)*$/;
  if (!validPathPattern.test(fieldPath)) {
    fail(errorPath, `invalid field path "${fieldPath}"`);
  }

  const segments = fieldPath.split(".");
  for (const segment of segments) {
    if (BLOCKED_PATH_SEGMENTS.has(segment)) {
      fail(errorPath, `unsafe field path segment "${segment}" in "${fieldPath}"`);
    }
  }
  return segments;
}

/**
 * @param {unknown} object
 * @param {string[]} segments
 * @param {string} fieldPath
 * @returns {unknown}
 */
function resolvePath(object, segments, fieldPath) {
  let current = object;
  const traversed = [];
  for (const segment of segments) {
    traversed.push(segment);
    if (current === null || typeof current !== "object") {
      fail(fieldPath, `cannot traverse "${traversed.join(".")}" through a non-object value`);
    }
    if (Array.isArray(current) && !/^(0|[1-9]\d*)$/.test(segment)) {
      fail(fieldPath, `expected an array index at "${traversed.join(".")}"`);
    }
    if (!Object.prototype.hasOwnProperty.call(current, segment)) {
      fail(fieldPath, `path segment "${segment}" does not exist at "${traversed.join(".")}"`);
    }
    current = /** @type {Record<string, unknown>} */ (current)[segment];
  }
  return current;
}

/**
 * 使用点分隔路径读取值；数组项使用 `stages.0.name` 形式的十进制索引段。
 *
 * @param {object} object
 * @param {string} fieldPath
 * @returns {unknown}
 */
export function getValueAtPath(object, fieldPath) {
  if (object === null || typeof object !== "object") {
    fail("object", "expected an object");
  }
  const path = assertString(fieldPath, "fieldPath");
  const segments = parseFieldPath(path, "fieldPath");
  return resolvePath(object, segments, path);
}

/**
 * 将补丁应用到现有字段并返回完全独立的副本，不保留源对象或补丁值的引用。
 *
 * @template {object} T
 * @param {T} object
 * @param {FieldPatch} patch
 * @returns {T}
 */
export function applyFieldPatch(object, patch) {
  assertFieldPatch(patch);
  assertJsonValue(object, "object");
  const segments = parseFieldPath(patch.fieldPath, "FieldPatch.fieldPath");
  resolvePath(object, segments, patch.fieldPath);

  const clonedObject = /** @type {T} */ (cloneJsonValue(/** @type {JsonValue} */ (object)));
  let target = /** @type {Record<string, unknown> | unknown[]} */ (clonedObject);
  for (let index = 0; index < segments.length - 1; index += 1) {
    target = /** @type {Record<string, unknown> | unknown[]} */ (
      /** @type {Record<string, unknown>} */ (target)[segments[index]]
    );
  }

  const finalSegment = segments[segments.length - 1];
  /** @type {Record<string, unknown>} */ (target)[finalSegment] = cloneJsonValue(patch.value);
  return clonedObject;
}

/**
 * 按 Unicode 码点而不是 UTF-16 代码单元计数。
 *
 * @param {string} text
 * @returns {number}
 */
export function countUnicodeCharacters(text) {
  return Array.from(assertString(text, "text")).length;
}

/**
 * @param {string} prefix
 * @returns {string}
 */
export function createId(prefix) {
  const safePrefix = assertString(prefix, "prefix").trim();
  if (safePrefix.length === 0) {
    fail("prefix", "expected a non-empty string");
  }

  const randomPart =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${safePrefix}-${randomPart}`;
}
