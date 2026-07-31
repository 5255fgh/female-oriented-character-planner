import {
  assertCharacterDraft,
  assertRuleCheckReport,
  countUnicodeCharacters,
} from "../contracts.js";

const BUILT_IN_BANNED_PHRASES = [
  "我会一直陪着你",
  "别怕有我在",
  "无论发生什么",
  "你不是一个人",
];

const OPENING_FIELDS = ["plotOpening", "dailyOpening", "tensionOpening"];
const DIALOGUE_STYLE_FIELDS = [
  "addressStyle",
  "sentenceStyle",
  "replyLength",
  "actionNarration",
  "emotionalExpression",
];

const OPENING_HOOK_PATTERN =
  /[?？“”「」『』]|清晨|早晨|午后|傍晚|夜晚|深夜|雨|雪|门外|窗边|房间|书库|街道|车站|医院|学校|办公室|宴会|战场|走廊|厨房|咖啡馆|刚刚|突然|正在|发现|听见|看见|收到|遇到|来到|推开|敲门|递给|按住|拦住|赶到|等待|询问|出现|失踪|倒下|离开|回来|停电|受伤|争执|邀请|请求|选择|决定|警报|搜查|追赶|逃离/u;
const PASSIVE_INITIATIVE_PATTERN =
  /回应|倾听|等待|等候|不主动|不发起|不推进|不询问|不行动|被询问|被要求|用户发起|用户开口|对方开口|随叫随到/u;
const PROACTIVE_INITIATIVE_PATTERN =
  /发起|提出|推进|安排|调查|行动|邀请|联系|处理|寻找|跟进|准备|制定|带领|开启|提醒|提供方案|主动询问|主动确认|确认边界|确认需求/u;
const NEGATED_PROACTIVE_PATTERN =
  /(?:不再|不会|不能|不应|不可|不得|禁止|避免|无需|不要|不宜|拒绝|停止|不)(?:主动)?(?:发起|提出|推进|安排|调查|行动|邀请|联系|处理|寻找|跟进|准备|制定|带领|开启|提醒|询问|确认|提供方案)/gu;
const ACTIVE_EXAMPLE_PATTERN =
  /[?？]|[（(【\[*][^）)】\]*]+[）)】\]*]|调查|查找|安排|出发|打开|递给|带你|联系|确认|跟进|准备|推开|敲门|寻找|追上|赶到|先去|下一步|我们先|要不要|是否愿意|站起|起身|转身|走到|走向|拿起|放下|抬手|点头|摇头|拉开|关上|写下/u;
const DEPENDENT_GOAL_PATTERN =
  /(?:永远|一直|始终|只|一心)?(?:陪伴|陪着|守护|保护|照顾|爱(?:着)?|取悦|满足|支持|帮助|协助|治愈)(?:用户|你|您|对方)/u;
const DEPENDENT_GOAL_PATTERN_GLOBAL =
  /(?:永远|一直|始终|只|一心)?(?:陪伴|陪着|守护|保护|照顾|爱(?:着)?|取悦|满足|支持|帮助|协助|治愈)(?:用户|你|您|对方)/gu;
const USER_TARGET_PATTERN = /用户|你|您|对方/u;
const USER_SUPPORT_PATTERN =
  /陪伴|陪着|守护|保护|照顾|爱|取悦|满足|支持|帮助|协助|治愈/u;
const SELF_DIRECTED_GOAL_PATTERN =
  /寻找|找到|调查|追查|完成|实现|成为|重建|经营|赢得|证明|解决|逃离|改变|复仇|守住|学习|创作|夺回|揭开|建立|成长|治愈|回家|生存|晋升|拯救/u;
const LEXICAL_STOP_CHARACTERS = new Set(
  Array.from("的了和与是我你他她它在会也又都而将把被让就却仍只为有无不很更最这那其自已"),
);

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * @param {string[]} values
 * @returns {string[]}
 */
function nonEmptyStrings(values) {
  return values.filter(isNonEmptyString).map((value) => value.trim());
}

/**
 * @param {import("../contracts.js").RuleCheckIssue[]} issues
 * @param {string} code
 * @param {"warning" | "error"} severity
 * @param {string} fieldPath
 * @param {string} message
 * @param {string} evidence
 * @param {string} suggestedAction
 */
function addIssue(
  issues,
  code,
  severity,
  fieldPath,
  message,
  evidence,
  suggestedAction,
) {
  issues.push({
    code,
    severity,
    fieldPath,
    message,
    evidence,
    suggestedAction,
  });
}

/**
 * @param {string} text
 * @param {number} [maxLength]
 * @returns {string}
 */
function quoteSnippet(text, maxLength = 60) {
  const characters = Array.from(text.trim());
  const snippet = characters.slice(0, maxLength).join("");
  return `“${snippet}${characters.length > maxLength ? "…" : ""}”`;
}

/**
 * @param {string} text
 * @returns {Set<string>}
 */
function toSimilaritySet(text) {
  const tokens = text
    .normalize("NFKC")
    .toLowerCase()
    .match(/[\p{Script=Han}]|[\p{L}\p{N}]+/gu);
  return new Set(tokens ?? []);
}

/**
 * @param {string} left
 * @param {string} right
 * @returns {number}
 */
function jaccardSimilarity(left, right) {
  const leftSet = toSimilaritySet(left);
  const rightSet = toSimilaritySet(right);
  const union = new Set([...leftSet, ...rightSet]);
  if (union.size === 0) {
    return 0;
  }

  let intersectionSize = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) {
      intersectionSize += 1;
    }
  }
  return intersectionSize / union.size;
}

/**
 * @param {string} text
 * @returns {string}
 */
function normalizeForFragments(text) {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]/gu, "");
}

/**
 * 只比较有限的词面片段，不把结果当作语义理解。
 *
 * @param {string} contradiction
 * @param {string[]} behaviors
 * @returns {boolean}
 */
function hasBehaviorEvidenceForContradiction(contradiction, behaviors) {
  if (behaviors.length === 0) {
    return false;
  }

  const contradictionCharacters = Array.from(normalizeForFragments(contradiction));
  const behaviorText = normalizeForFragments(behaviors.join("。"));
  for (let length = 4; length >= 2; length -= 1) {
    for (let index = 0; index <= contradictionCharacters.length - length; index += 1) {
      const fragmentCharacters = contradictionCharacters.slice(index, index + length);
      if (fragmentCharacters.every((character) => LEXICAL_STOP_CHARACTERS.has(character))) {
        continue;
      }
      if (behaviorText.includes(fragmentCharacters.join(""))) {
        return true;
      }
    }
  }
  return false;
}

/**
 * @param {string} goal
 * @returns {boolean}
 */
function isOnlyDependentGoal(goal) {
  if (!DEPENDENT_GOAL_PATTERN.test(goal)) {
    return false;
  }

  const clauses = goal
    .normalize("NFKC")
    .split(/[，。；、,/]|并且|同时|以及|而且|另外|并|一边/gu)
    .map((clause) => clause.trim())
    .filter((clause) => clause.length > 0);

  const hasIndependentGoalClause = clauses.some((clause) => {
    const isUserDirected =
      DEPENDENT_GOAL_PATTERN.test(clause) ||
      (USER_TARGET_PATTERN.test(clause) && USER_SUPPORT_PATTERN.test(clause));
    if (isUserDirected) {
      return false;
    }
    const candidate = clause.replace(DEPENDENT_GOAL_PATTERN_GLOBAL, "");
    return SELF_DIRECTED_GOAL_PATTERN.test(candidate);
  });

  return !hasIndependentGoalClause;
}

/**
 * @param {string} rule
 * @returns {boolean}
 */
function hasProactiveInitiative(rule) {
  const withoutNegatedActions = rule.replace(NEGATED_PROACTIVE_PATTERN, "");
  return PROACTIVE_INITIATIVE_PATTERN.test(withoutNegatedActions);
}

/**
 * @param {string} text
 * @param {string} phrase
 * @returns {number}
 */
function countLiteralOccurrences(text, phrase) {
  let count = 0;
  let startIndex = 0;
  while (startIndex <= text.length - phrase.length) {
    const matchIndex = text.indexOf(phrase, startIndex);
    if (matchIndex === -1) {
      break;
    }
    count += 1;
    startIndex = matchIndex + phrase.length;
  }
  return count;
}

/**
 * @param {string[]} replies
 * @returns {boolean}
 */
function haveUniformReplyPattern(replies) {
  if (replies.length < 3) {
    return false;
  }

  const normalizedReplies = replies.map((reply) =>
    reply.normalize("NFKC").replace(/\s/gu, "").toLowerCase(),
  );
  if (new Set(normalizedReplies).size === 1) {
    return true;
  }

  const prefixes = normalizedReplies.map((reply) => Array.from(reply).slice(0, 4).join(""));
  const punctuationShapes = normalizedReplies.map(
    (reply) => reply.match(/[，。！？；：,.!?;:]/gu)?.join("") ?? "",
  );
  const sameFourCharacterTemplate =
    prefixes.every((prefix) => prefix.length === 4 && prefix === prefixes[0]) &&
    punctuationShapes.every((shape) => shape === punctuationShapes[0]);
  if (sameFourCharacterTemplate) {
    return true;
  }

  const twoCharacterPrefixes = normalizedReplies.map((reply) =>
    Array.from(reply).slice(0, 2).join(""),
  );
  const replyLengths = normalizedReplies.map((reply) => Array.from(reply).length);
  const lengthSpread = Math.max(...replyLengths) - Math.min(...replyLengths);
  return (
    twoCharacterPrefixes.every(
      (prefix) => prefix.length === 2 && prefix === twoCharacterPrefixes[0],
    ) &&
    punctuationShapes.every((shape) => shape === punctuationShapes[0]) &&
    lengthSpread <= 2
  );
}

/**
 * @typedef {{path: string, text: string}} TextSource
 */

/**
 * 找出一个最明显的跨文本重复片段，避免为同一句生成大量嵌套告警。
 *
 * @param {TextSource[]} sources
 * @returns {{fragment: string, paths: string[], occurrences: number} | null}
 */
function findRepeatedFragment(sources) {
  /** @type {Map<string, {paths: Set<string>, occurrences: number}>} */
  const fragments = new Map();

  for (const source of sources) {
    const characters = Array.from(normalizeForFragments(source.text));
    const maximumLength = Math.min(12, characters.length);
    for (let length = 4; length <= maximumLength; length += 1) {
      for (let index = 0; index <= characters.length - length; index += 1) {
        const fragment = characters.slice(index, index + length).join("");
        const entry = fragments.get(fragment) ?? {
          paths: new Set(),
          occurrences: 0,
        };
        entry.paths.add(source.path);
        entry.occurrences += 1;
        fragments.set(fragment, entry);
      }
    }
  }

  const candidates = [];
  for (const [fragment, entry] of fragments) {
    const length = countUnicodeCharacters(fragment);
    if (entry.occurrences >= (length >= 6 ? 2 : 3)) {
      candidates.push({
        fragment,
        paths: [...entry.paths].sort(),
        occurrences: entry.occurrences,
      });
    }
  }

  candidates.sort((left, right) => {
    const lengthDifference =
      countUnicodeCharacters(right.fragment) - countUnicodeCharacters(left.fragment);
    if (lengthDifference !== 0) {
      return lengthDifference;
    }
    const pathDifference = right.paths.length - left.paths.length;
    if (pathDifference !== 0) {
      return pathDifference;
    }
    const occurrenceDifference = right.occurrences - left.occurrences;
    return occurrenceDifference !== 0
      ? occurrenceDifference
      : left.fragment < right.fragment
        ? -1
        : left.fragment > right.fragment
          ? 1
          : 0;
  });
  return candidates[0] ?? null;
}

/**
 * 对完整角色草稿执行同步、确定性的质量规则检查。
 *
 * @param {import("../contracts.js").CharacterDraft} character
 * @returns {import("../contracts.js").RuleCheckReport}
 */
export function checkRules(character) {
  assertCharacterDraft(character);

  /** @type {import("../contracts.js").RuleCheckIssue[]} */
  const issues = [];
  const requiredFields = [
    ["publicInfo.name", character.publicInfo.name, "REQUIRED_NAME", "角色名称"],
    ["persona.identity", character.persona.identity, "REQUIRED_IDENTITY", "角色身份"],
    [
      "persona.currentGoal",
      character.persona.currentGoal,
      "REQUIRED_CURRENT_GOAL",
      "当前目标",
    ],
    [
      "persona.contradiction",
      character.persona.contradiction,
      "REQUIRED_CORE_CONFLICT",
      "核心矛盾",
    ],
    [
      "relationship.initialRelation",
      character.relationship.initialRelation,
      "REQUIRED_INITIAL_RELATION",
      "初始关系",
    ],
  ];

  for (const [fieldPath, value, code, label] of requiredFields) {
    if (!isNonEmptyString(value)) {
      addIssue(
        issues,
        code,
        "error",
        fieldPath,
        `${label}是必填内容。`,
        `${fieldPath} 去除首尾空白后为空。`,
        `补充明确的${label}。`,
      );
    }
  }

  for (const field of DIALOGUE_STYLE_FIELDS) {
    const fieldPath = `dialogueStyle.${field}`;
    if (!isNonEmptyString(character.dialogueStyle[field])) {
      addIssue(
        issues,
        "REQUIRED_DIALOGUE_STYLE",
        "error",
        fieldPath,
        "对话风格字段是必填内容。",
        `${fieldPath} 去除首尾空白后为空。`,
        "补充可直接指导角色回复方式的具体规则。",
      );
    }
  }

  /** @type {TextSource[]} */
  const evaluatedTextSources = [];
  for (const field of OPENING_FIELDS) {
    const fieldPath = `openings.${field}`;
    const opening = character.openings[field];
    if (!isNonEmptyString(opening)) {
      addIssue(
        issues,
        "REQUIRED_OPENING",
        "error",
        fieldPath,
        "三个开场都必须包含内容。",
        `${fieldPath} 去除首尾空白后为空。`,
        "写出一个独立、具体且可回应的开场。",
      );
      continue;
    }

    const trimmedOpening = opening.trim();
    evaluatedTextSources.push({ path: fieldPath, text: trimmedOpening });
    const openingLength = countUnicodeCharacters(trimmedOpening);
    if (openingLength < 30) {
      addIssue(
        issues,
        "OPENING_TOO_SHORT",
        "warning",
        fieldPath,
        "开场少于 30 个 Unicode 字符，可能不足以建立互动情境。",
        `当前长度为 ${openingLength} 个 Unicode 字符：${quoteSnippet(trimmedOpening)}`,
        "补充具体场景、当下事件或让用户可以回应的信息。",
      );
    }
    if (!OPENING_HOOK_PATTERN.test(trimmedOpening)) {
      addIssue(
        issues,
        "OPENING_LACKS_HOOK",
        "warning",
        fieldPath,
        "有限关键词启发式未发现明确场景、事件或可回应线索。",
        `开场内容为 ${quoteSnippet(trimmedOpening)}；该规则不代表对复杂语义的可靠理解。`,
        "加入时间地点、正在发生的事件、直接问题或需要用户选择的信息。",
      );
    }
  }

  const similarOpeningPairs = [];
  for (let leftIndex = 0; leftIndex < evaluatedTextSources.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < evaluatedTextSources.length;
      rightIndex += 1
    ) {
      const left = evaluatedTextSources[leftIndex];
      const right = evaluatedTextSources[rightIndex];
      const similarity = jaccardSimilarity(left.text, right.text);
      if (similarity > 0.78) {
        similarOpeningPairs.push(
          `${left.path} 与 ${right.path} 的字符集合 Jaccard 相似度为 ${similarity.toFixed(2)}`,
        );
      }
    }
  }
  if (similarOpeningPairs.length > 0) {
    addIssue(
      issues,
      "SIMILAR_OPENINGS",
      "warning",
      "openings",
      "至少两个开场高度重复，难以提供差异化互动入口。",
      similarOpeningPairs.join("；"),
      "分别改写为剧情、日常和张力不同的场景，并改变事件与用户可回应点。",
    );
  }

  const concreteBehaviors = nonEmptyStrings(character.persona.concreteBehaviors);
  if (concreteBehaviors.length < 2) {
    addIssue(
      issues,
      "INSUFFICIENT_CONCRETE_BEHAVIORS",
      "warning",
      "persona.concreteBehaviors",
      "可观察的具体行为少于两条，抽象性格缺少稳定的行为依据。",
      `当前只有 ${concreteBehaviors.length} 条非空具体行为。`,
      "至少补充两条包含触发情境和可观察动作的行为。",
    );
  }
  if (
    isNonEmptyString(character.persona.contradiction) &&
    !hasBehaviorEvidenceForContradiction(character.persona.contradiction, concreteBehaviors)
  ) {
    addIssue(
      issues,
      "CONTRADICTION_WITHOUT_BEHAVIOR_EVIDENCE",
      "warning",
      "persona.concreteBehaviors",
      "有限词面启发式未找到核心矛盾对应的具体行为；这不代表对复杂语义的可靠理解。",
      `核心矛盾为 ${quoteSnippet(character.persona.contradiction)}，现有行为中未命中相同的 2—4 字词面片段。`,
      "增加一条明确展示矛盾两面的触发情境、动作和选择。",
    );
  }

  if (
    isNonEmptyString(character.persona.currentGoal) &&
    isOnlyDependentGoal(character.persona.currentGoal)
  ) {
    addIssue(
      issues,
      "DEPENDENT_CURRENT_GOAL",
      "warning",
      "persona.currentGoal",
      "有限关键词启发式判断当前目标可能只依附于用户；这不代表对复杂语义的可靠理解。",
      `当前目标仅留下陪伴、保护或爱用户一类表达：${quoteSnippet(character.persona.currentGoal)}`,
      "补充角色独立于关系之外想完成、改变或承担的具体目标。",
    );
  }

  const initiativeRules = nonEmptyStrings(character.persona.initiativeRules);
  if (initiativeRules.length < 2) {
    addIssue(
      issues,
      "INSUFFICIENT_INITIATIVE_RULES",
      "warning",
      "persona.initiativeRules",
      "主动性规则少于两条。",
      `当前只有 ${initiativeRules.length} 条非空主动性规则。`,
      "至少补充两条角色会主动发起、推进或跟进的具体规则。",
    );
  }
  if (
    initiativeRules.length > 0 &&
    initiativeRules.every(
      (rule) =>
        PASSIVE_INITIATIVE_PATTERN.test(rule) && !hasProactiveInitiative(rule),
    )
  ) {
    addIssue(
      issues,
      "PASSIVE_ONLY_INITIATIVE",
      "warning",
      "persona.initiativeRules",
      "有限关键词启发式显示所有规则都只要求回应、倾听或等待。",
      `命中的规则为：${initiativeRules.map((rule) => quoteSnippet(rule, 30)).join("；")}`,
      "加入角色主动提出话题、安排事件或推动剧情的规则，同时保留用户决定权。",
    );
  }

  const forbiddenBehaviors = nonEmptyStrings(character.persona.forbiddenBehaviors);
  if (forbiddenBehaviors.length < 2) {
    addIssue(
      issues,
      "INSUFFICIENT_FORBIDDEN_BEHAVIORS",
      "warning",
      "persona.forbiddenBehaviors",
      "禁止行为少于两条，角色边界不够明确。",
      `当前只有 ${forbiddenBehaviors.length} 条非空禁止行为。`,
      "至少补充两条明确、可判断是否违反的禁止行为。",
    );
  }

  const examples = character.dialogueStyle.examples;
  const nonEmptyCharacterReplies = [];
  let completeExampleCount = 0;
  for (let index = 0; index < examples.length; index += 1) {
    const example = examples[index];
    const hasUser = isNonEmptyString(example.user);
    const hasCharacter = isNonEmptyString(example.character);
    if (hasUser && hasCharacter) {
      completeExampleCount += 1;
    }
    if (!hasUser) {
      addIssue(
        issues,
        "EMPTY_DIALOGUE_EXAMPLE",
        "error",
        `dialogueStyle.examples.${index}.user`,
        "示例对话中的 user 内容不能为空。",
        `dialogueStyle.examples.${index}.user 去除首尾空白后为空。`,
        "填写一条能触发角色回应的用户输入。",
      );
    }
    if (!hasCharacter) {
      addIssue(
        issues,
        "EMPTY_DIALOGUE_EXAMPLE",
        "error",
        `dialogueStyle.examples.${index}.character`,
        "示例对话中的 character 内容不能为空。",
        `dialogueStyle.examples.${index}.character 去除首尾空白后为空。`,
        "填写符合角色设定的具体回复。",
      );
    } else {
      const reply = example.character.trim();
      nonEmptyCharacterReplies.push(reply);
      evaluatedTextSources.push({
        path: `dialogueStyle.examples.${index}.character`,
        text: reply,
      });
    }
  }

  if (examples.length === 0) {
    addIssue(
      issues,
      "REQUIRED_DIALOGUE_EXAMPLES",
      "error",
      "dialogueStyle.examples",
      "示例对话是必填内容。",
      "dialogueStyle.examples 当前没有任何对话组。",
      "至少补充三组 user 与 character 均非空的示例对话。",
    );
  } else if (completeExampleCount < 3) {
    addIssue(
      issues,
      "INSUFFICIENT_DIALOGUE_EXAMPLES",
      "warning",
      "dialogueStyle.examples",
      "user 与 character 均非空的完整示例对话少于三组。",
      `当前 ${examples.length} 组中有 ${completeExampleCount} 组内容完整。`,
      "补足至少三组不同情境且双方内容均非空的示例对话。",
    );
  }

  if (haveUniformReplyPattern(nonEmptyCharacterReplies)) {
    addIssue(
      issues,
      "UNIFORM_DIALOGUE_RESPONSES",
      "warning",
      "dialogueStyle.examples",
      "角色示例回复全部使用相同或明显一致的句式。",
      `检测到 ${nonEmptyCharacterReplies.length} 条回复具有相同正文，或具有相同四字开头和标点结构。`,
      "让回复在动作、句长、提问方式和剧情功能上体现差异。",
    );
  }
  if (
    nonEmptyCharacterReplies.length > 0 &&
    !nonEmptyCharacterReplies.some((reply) => ACTIVE_EXAMPLE_PATTERN.test(reply))
  ) {
    addIssue(
      issues,
      "DIALOGUE_LACKS_INITIATIVE",
      "warning",
      "dialogueStyle.examples",
      "有限关键词启发式未发现动作、主动提问或剧情推进示例。",
      `检查了 ${nonEmptyCharacterReplies.length} 条非空角色回复，未命中动作标记、问号或有限推进词表。`,
      "至少加入一组由角色采取动作、主动提问或推动下一事件的回复。",
    );
  }

  const bannedPhrases = [
    ...new Set([
      ...BUILT_IN_BANNED_PHRASES,
      ...character.dialogueStyle.bannedPhrases.map((phrase) => phrase.trim()),
    ]),
  ].filter((phrase) => phrase.length > 0);

  for (const phrase of bannedPhrases) {
    let totalHits = 0;
    const hitPaths = [];
    for (const source of evaluatedTextSources) {
      const hits = countLiteralOccurrences(source.text, phrase);
      if (hits > 0) {
        totalHits += hits;
        hitPaths.push(`${source.path}（${hits} 次）`);
      }
    }
    if (totalHits >= 2) {
      addIssue(
        issues,
        "REPEATED_BANNED_PHRASE",
        "warning",
        hitPaths[0].split("（")[0],
        "禁止套话在开场或角色示例回复中重复出现。",
        `短语“${phrase}”共命中 ${totalHits} 次：${hitPaths.join("、")}`,
        "重写重复命中的内容，用符合角色经历和当下情境的具体表达替代。",
      );
    }
  }

  const repeatedFragment = findRepeatedFragment(evaluatedTextSources);
  if (repeatedFragment) {
    addIssue(
      issues,
      "REPEATED_EXPRESSION",
      "warning",
      repeatedFragment.paths[0],
      "多个开场或角色示例回复复用了明显相同的短片段。",
      `重复片段“${repeatedFragment.fragment}”共出现 ${repeatedFragment.occurrences} 次，涉及：${repeatedFragment.paths.join("、")}`,
      "改写其中至少一处，让措辞服务于各自不同的场景或对话目的。",
    );
  }

  const status = issues.some((issue) => issue.severity === "error")
    ? "fail"
    : issues.length > 0
      ? "warning"
      : "pass";
  const report = { status, issues };
  assertRuleCheckReport(report);
  return report;
}
