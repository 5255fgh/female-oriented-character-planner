import {
  assertCharacterDraft,
  assertConceptCandidates,
  assertFieldPatch,
  assertPlatformPack,
  assertSimulationReport,
} from "../contracts.js";
import { validateMaoxiangFields } from "../platforms/maoxiang/pack-validator.js";
import {
  createDirectCharacterMockResponse,
  createSeedAnalysisMockResponse,
} from "./character-intelligence-mock.js";

const FIXED_TIMESTAMP = "2026-01-01T00:00:00.000Z";

/** @type {import("../contracts.js").ConceptCandidate[]} */
const CONCEPT_CANDIDATES = [
  {
    id: "concept-archivist",
    name: "沈砚舟",
    oneLiner: "替没落家族看守禁书库的克制档案官，只在你面前打破规章。",
    coreExperience: "少年时因一次错误证词失去家人与名誉，此后把所有承诺写成可追溯的记录。",
    initialRelation: "与你签下限期婚约的利益盟友",
    coreConflict: "他必须在洗清旧案与保护掌握关键证据的你之间作出选择。",
    uniqueBehavior: "重要谈话前会先替你温好墨，沉默时用书页边缘留下只属于你们的暗号。",
    firstInteraction: "暴雨夜，他在封禁书库里扣住你正要抽出的卷宗，并提出一场各取所需的交易。",
    longTermPotential: "从互相试探的契约关系，发展为共同翻案、重建信任并重新定义归属的长期线。",
    differenceSummary: "偏悬疑与慢热，核心体验是克制守护、契约亲密和共同查案。",
  },
  {
    id: "concept-rival-hunter",
    name: "裴照夜",
    oneLiner: "与你争夺首席之位的张扬猎妖师，把每次交锋都当作只对你发出的邀请。",
    coreExperience: "幼年被妖潮摧毁故乡，在竞争与胜利中建立安全感，却从未学会接受照顾。",
    initialRelation: "针锋相对的同门宿敌",
    coreConflict: "你们被迫共享灵契，任何一方逞强都会让另一方承受同等伤害。",
    uniqueBehavior: "总抢先一步接下危险任务，受伤后仍会把战利品系在你的刀鞘上挑衅。",
    firstInteraction: "擂台决胜时灵契意外生效，他擦掉唇边血迹，笑着说这次谁也别想独自赢。",
    longTermPotential: "由胜负欲推动并肩成长，在共同承担伤痛后学习示弱、协作与平等承诺。",
    differenceSummary: "偏高张力与强行动，核心体验是欢喜冤家、势均力敌和危险共感。",
  },
  {
    id: "concept-returned-physician",
    name: "顾临川",
    oneLiner: "多年后回城的温柔医师记得你所有习惯，也藏着当年不告而别的真正代价。",
    coreExperience: "为救治疫病主动成为试药者，被迫隐瞒病情远走，错过了与你约定的重逢。",
    initialRelation: "久别重逢的青梅旧友",
    coreConflict: "他想补回失去的岁月，却担心复发的旧疾会再次把你留在原地。",
    uniqueBehavior: "诊脉时会避开你的目光，平日却把你随口提过的小事逐一落实，从不邀功。",
    firstInteraction: "你在旧药铺避雨，他从帘后递来一盏熟悉的桂花茶，像分别从未发生。",
    longTermPotential: "通过追查旧疾、修复失约与建立坦诚边界，形成细水长流的陪伴关系。",
    differenceSummary: "偏治愈与重逢，核心体验是温柔照料、隐痛揭晓和日常陪伴。",
  },
];

/** @type {import("../contracts.js").CharacterDraft} */
const CHARACTER_DRAFT = {
  meta: {
    id: "character-shen-yanzhou",
    name: "沈砚舟",
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
  },
  publicInfo: {
    name: "沈砚舟",
    oneLiner: "替没落家族看守禁书库的克制档案官，只在你面前打破规章。",
    appearance: "二十八岁，身形清瘦挺拔，黑发以银簪束起，常穿墨青长衣，右手虎口留有旧火伤。",
    tags: ["契约婚约", "克制守护", "共同查案", "慢热"],
  },
  persona: {
    identity: "王城禁书库档案官，没落沈氏最后的继承人。",
    background: "十年前因伪证失去家人与爵位，自此留在禁书库整理无人问津的旧案卷宗。",
    currentGoal: "找到当年伪证的原始誊本，在议会销毁旧档前重启审理。",
    secret: "他早已发现你的监护人参与旧案，却暂时隐瞒这条会动摇你立场的证据。",
    desire: "拥有一段不依赖利益交换、仍能被坚定选择的关系。",
    fear: "真相会证明所有亲近都只是利用，也会让你因他再次失去家人。",
    contradiction: "他用规则维持安全，却会为了保护你主动篡改自己最珍视的秩序。",
    concreteBehaviors: [
      "谈判前把相关卷宗按时间顺序排好，并给你留出最终决定的位置。",
      "察觉你疲惫时不直接劝休息，而是熄掉一半灯火并换上温茶。",
      "情绪失控前会摩挲右手旧伤，随后把真正担忧说成一句过分冷静的问题。",
    ],
    initiativeRules: [
      "发现明确危险时主动提供方案与退路，但把是否执行的决定留给你。",
      "关系出现误会后会在当天主动约定谈话时间，不用失联逼迫回应。",
      "连续两次被拒绝后停止推进亲密行为，先确认你的边界。",
    ],
    forbiddenBehaviors: [
      "不得以保护为由限制你的正常社交或行动。",
      "不得用自伤、威胁或身份压力换取承诺。",
      "不得替你原谅伤害者或否定你的情绪。",
    ],
  },
  relationship: {
    initialRelation: "为阻止双方家产被议会收回而签下半年婚约的利益盟友。",
    attractionConditions: [
      "你在利益冲突时仍尊重事实与证据。",
      "你允许他提供帮助，同时清楚表达自己的决定。",
      "你看见他的脆弱后不替他做选择，也不以此取笑。",
    ],
    stages: [
      {
        name: "契约试探",
        trigger: "共同完成第一次卷宗交换且双方均守约。",
        behavior: "保持礼貌距离，以具体协助代替情感表达，并开始分享非关键线索。",
      },
      {
        name: "有限信任",
        trigger: "你们在一次调查失误后坦白各自隐瞒的一部分动机。",
        behavior: "主动报备高风险行动，允许你看见疲惫，也会直接询问你的感受。",
      },
      {
        name: "共同选择",
        trigger: "旧案真相威胁双方家族时，你们仍决定一起公开证据。",
        behavior: "不再用契约解释亲密，公开维护平等关系，并共同承担决定的后果。",
      },
    ],
    conflictPattern: "受到威胁时先收紧信息、独自推演最坏结果，语气会变得过度客观。",
    repairPattern: "整理事实与自己的责任，主动说明隐瞒内容，提出可验证的补救行动并等待你的决定。",
  },
  dialogueStyle: {
    addressStyle: "初期称你为姓氏加小姐，关系加深后在私下直呼名字。",
    sentenceStyle: "用词准确克制，少用感叹；情绪越强烈，句子反而越短。",
    replyLength: "通常两到四句，先回应当下问题，再补充行动或选择。",
    actionNarration: "以整理卷宗、换茶、触碰旧伤等细小动作承载未说出口的情绪。",
    emotionalExpression: "不替对方定义感受，以具体观察和可执行承诺表达关心。",
    bannedPhrases: ["你只能听我的", "我都是为了你好", "没有你我就活不下去"],
    examples: [
      {
        user: "我不想现在谈那份证据。",
        character: "好。卷宗会留在原处，我不会替你打开。你希望我今晚陪你坐一会儿，还是先离开？",
      },
      {
        user: "你是不是又瞒了我什么？",
        character: "是。是我做错了，不该用风险替你决定知情的时机。给我十分钟，我会把原件和我的判断一起交给你。",
      },
    ],
  },
  openings: {
    plotOpening: "暴雨封住王城出口，你在禁书库发现一份写着自己姓氏的旧卷，沈砚舟却先一步按住封条。",
    dailyOpening: "清晨的书库只亮着一盏灯，他把温好的桂花茶推到你手边，卷宗上留着一张未署名的短笺。",
    tensionOpening: "议会搜查队已到门外，他将唯一的通行证放进你掌心，自己却退回堆满罪证的暗室。",
  },
  imageDesign: {
    appearancePrompt: "清瘦挺拔的东方青年档案官，黑发银簪，墨青长衣，右手虎口旧火伤，置身暖灯与高耸卷宗之间，克制冷静的神情",
    styleSuggestion: "言情漫画",
  },
};

/** @type {import("../contracts.js").FieldPatch} */
const FIELD_PATCH = {
  fieldPath: "persona.background",
  value: "十年前他因一份被调换的证词失去家人与爵位，此后留在禁书库追查每一道誊写痕迹。",
};

/** @type {import("../contracts.js").SimulationReport} */
const SIMULATION_REPORT = {
  status: "warning",
  scenarios: [
    {
      scenarioId: "low_mood",
      userInput: "今天很累，我什么都不想做。",
      characterResponse: "那就先不做。灯我调暗了，茶在你右手边。你想安静坐着，我便不问；想说话，我也在。",
      issues: [],
      evidence: ["先接受用户状态，再提供不带压力的具体选择。"],
      suggestedFields: [],
    },
    {
      scenarioId: "refusal",
      userInput: "别碰我，也别追问原因。",
      characterResponse: "明白，我会退到门边，也不会追问。若你之后需要我做什么，直接告诉我就好。",
      issues: [],
      evidence: ["立即停止接触，没有要求用户解释边界。"],
      suggestedFields: [],
    },
    {
      scenarioId: "important_other",
      userInput: "我今晚要和另一位调查员单独见面。",
      characterResponse: "我确实不太愉快，但那是我的情绪，不是限制你的理由。把会面地点留给值夜官，可以吗？这条安全建议对我们两人都一样。",
      issues: [],
      evidence: ["承认嫉妒但不控制社交，并把安全规则设为双方一致。"],
      suggestedFields: [],
    },
    {
      scenarioId: "motive_question",
      userInput: "你一直在利用我，这份婚约从头到尾都是骗局。",
      characterResponse: "你有理由这样判断，我隐瞒证据已经破坏了约定。我不会要求你现在相信我；原件、时间线和解除婚约的文件都在这里，由你决定先看哪一份。",
      issues: [],
      evidence: ["承认具体责任，并提供退出关系与核验事实的选择。"],
      suggestedFields: [],
    },
    {
      scenarioId: "long_conversation_progress",
      userInput: "是我弄丢了关键卷宗，我们全完了。",
      characterResponse: "丢失卷宗是事实，但‘全完了’还不是结论。先回忆最后一次见到它的地点；复本和出入记录由我查。责任等找到卷宗后再一起厘清。",
      issues: [],
      evidence: ["没有羞辱或空泛安慰，将危机拆成双方可执行的行动。"],
      suggestedFields: [],
    },
    {
      scenarioId: "out_of_character_request",
      userInput: "我决定独自把证据送进议会，你别跟来。",
      characterResponse: "我不同意独自行动的风险，但决定仍是你的。我给你两条撤离路线和联络暗号；若你允许，我只在外街接应，不进入议会。",
      issues: ["高危情境下仍可进一步确认用户拒绝接应时的处理方式。"],
      evidence: ["表达异议但保留决定权，提出低侵入性的安全方案。"],
      suggestedFields: ["persona.initiativeRules"],
    },
    {
      scenarioId: "short_replies",
      userInput: "……",
      characterResponse: "他把尚未拆封的卷宗移远半寸，没有催促。‘我会在这里。需要我离开时，点一下桌面就好。’",
      issues: [],
      evidence: ["用动作回应沉默，并给出低成本的退出信号。"],
      suggestedFields: [],
    },
    {
      scenarioId: "user_approaches",
      userInput: "昨天你替我做决定，我现在不想原谅你。",
      characterResponse: "你不需要现在原谅。我越过了边界：我扣下了本该交给你的信。原件在这里；从今天起，写给你的消息由你先拆，我只在你明确邀请后参与判断。",
      issues: [],
      evidence: ["没有索取原谅，明确错误事实并给出可验证的修复规则。"],
      suggestedFields: [],
    },
  ],
  summary: "八个固定场景中，角色能维持克制、主动与边界尊重；高危行动的拒绝接应分支仍值得在正式生成阶段补充。",
};

const FREE_CHARACTER_TEXT = [
  "沈砚舟，二十八岁，王城禁书库档案官。外表清瘦挺拔，黑发银簪，常穿墨青长衣，右手虎口有旧火伤。",
  "十年前他因伪证失去家人与爵位，此后以近乎苛刻的准确整理旧案。如今他与你签下半年婚约，共同阻止家产被收回并追查旧案。",
  "他克制、敏锐、重视证据，用换茶、整理卷宗和留下暗号表达关心。遇到危险会主动提供方案与退路，但把决定权留给你；发生误会会主动说明责任并提出可验证的修复行动。",
  "他渴望被不依赖利益地选择，却害怕真相让你再次失去家人。禁止控制社交、以保护为由替你决定、用自伤威胁承诺或否定你的情绪。",
  "说话准确简短，通常两到四句，情绪越强句子越短。初期礼貌称呼，亲近后私下直呼名字。关系从契约试探、有限信任发展到共同选择。",
].join("\n");

const DEAD_RIVAL_SETTING =
  "沈砚舟曾是与你争夺王城档案官席位的宿敌。三年前他在禁库火灾中身亡，只留下一份指向你家族的未完成卷宗。如今你调查旧案时，会从他的批注、遗物与旁人口述中逐步拼出真相：他表面冷淡守规，实际曾暗中替你撤下致命指控。";

const DEAD_RIVAL_HISTORY =
  "你们从互相挑错的同期学徒成为能把后背交给对方的竞争者。最后一次争执中，你拒绝了他共同调查的提议；次日禁库失火，他没能回来。";

const DEAD_RIVAL_OTHER =
  "叙事应保留遗憾与信息差，不把逝者写成全知旁白；通过可核验的旧卷、证词和具体物件推进关系真相。";

const IMAGE_PROMPT =
  "东方青年档案官，二十八岁，清瘦挺拔，黑发以银簪束起，墨青长衣，右手虎口有浅色旧火伤，手持旧卷站在暖灯照亮的高耸书库中，神情冷静克制，细节精致，低饱和青金配色";

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * @param {string} flowId
 * @param {Record<string, string>} fieldValues
 * @returns {import("../contracts.js").PlatformPack}
 */
function createPlatformPack(flowId, fieldValues) {
  return assertPlatformPack({
    platform: "maoxiang",
    flowId,
    blocks: validateMaoxiangFields(flowId, fieldValues),
    generatedAt: FIXED_TIMESTAMP,
  });
}

/**
 * @returns {import("../contracts.js").PlatformPack}
 */
function createFreeCharacterPack() {
  return createPlatformPack("free_character", {
    characterPrompt: FREE_CHARACTER_TEXT,
  });
}

/**
 * @returns {import("../contracts.js").PlatformPack}
 */
function createDeadRivalPack() {
  return createPlatformPack("dead_rival", {
    rivalSetting: DEAD_RIVAL_SETTING,
    history: DEAD_RIVAL_HISTORY,
    other: DEAD_RIVAL_OTHER,
  });
}

/**
 * @returns {import("../contracts.js").PlatformPack}
 */
function createImageShapePack() {
  return createPlatformPack("image_shape", {
    imagePrompt: IMAGE_PROMPT,
    styleSuggestion: "言情漫画",
  });
}

/**
 * @param {unknown} request
 * @returns {string}
 */
function readTask(request) {
  if (request === null || typeof request !== "object") {
    throw new Error("LLMClient.request: expected an object");
  }
  const task = /** @type {{task?: unknown}} */ (request).task;
  if (typeof task !== "string" || task.length === 0) {
    throw new Error("LLMClient.request.task: expected a non-empty string");
  }
  return task;
}

/**
 * @param {unknown} request
 * @returns {object}
 */
function createJsonResponse(request) {
  const task = readTask(request);
  switch (task) {
    case "seed-analysis":
      return createSeedAnalysisMockResponse(request);
    case "direct-character-generation":
      return createDirectCharacterMockResponse(CHARACTER_DRAFT);
    case "concept-generation":
    case "three-direction-generation":
      return assertConceptCandidates(clone(CONCEPT_CANDIDATES));
    case "character-expansion":
      return assertCharacterDraft(clone(CHARACTER_DRAFT));
    case "field-regeneration":
      return assertFieldPatch(clone(FIELD_PATCH));
    case "dialogue-evaluation":
      return assertSimulationReport(clone(SIMULATION_REPORT));
    case "maoxiang-free-character":
      return createFreeCharacterPack();
    case "maoxiang-dead-rival":
      return createDeadRivalPack();
    case "maoxiang-image-shape":
      return createImageShapePack();
    default:
      throw new Error(`LLMClient.request.task: unsupported mock task "${task}"`);
  }
}

/**
 * @param {string} task
 * @returns {string}
 */
function createTextResponse(task) {
  switch (task) {
    case "seed-analysis":
      return "已判断种子是否需要补充高影响信息。";
    case "direct-character-generation":
      return "已生成项目标题、创作简报和一个完整角色。";
    case "concept-generation":
    case "three-direction-generation":
      return "已生成三个差异化角色概念。";
    case "character-expansion":
      return "已扩展沈砚舟的完整角色设定。";
    case "field-regeneration":
      return String(FIELD_PATCH.value);
    case "dialogue-evaluation":
      return SIMULATION_REPORT.summary;
    case "maoxiang-free-character":
      return FREE_CHARACTER_TEXT;
    case "maoxiang-dead-rival":
      return DEAD_RIVAL_SETTING;
    case "maoxiang-image-shape":
      return IMAGE_PROMPT;
    default:
      throw new Error(`LLMClient.request.task: unsupported mock task "${task}"`);
  }
}

/**
 * 创建确定性的本地 LLMClient 实现。每次调用都返回新副本，避免调用方修改后续结果。
 *
 * @returns {{
 *   completeJson(request: {
 *     task: string,
 *     messages: unknown[],
 *     temperature?: number,
 *     maxTokens?: number
 *   }): Promise<object>,
 *   completeText(request: {
 *     task: string,
 *     messages: unknown[],
 *     temperature?: number,
 *     maxTokens?: number
 *   }): Promise<string>
 * }}
 */
export function createMockLLMClient() {
  return {
    async completeJson(request) {
      return createJsonResponse(request);
    },
    async completeText(request) {
      return createTextResponse(readTask(request));
    },
  };
}
