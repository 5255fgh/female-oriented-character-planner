import {
  assertArray,
  assertEnum,
  assertExactKeys,
  assertObject,
  assertString,
  assertStringArray,
  fail,
} from "./common.js";
import {
  validateCharacterDraft,
  validateConceptCandidate,
  validateConceptCandidates,
  validateCreativeBrief,
  validateCreativeSeed,
} from "./character.js";
import { validatePlatformPack } from "./platform.js";
import { validateStoryDraft, validateWorldBible } from "./world-story.js";

/** @typedef {"pass" | "warning" | "fail"} ReportStatus */
/** @typedef {{status: ReportStatus, issues: Array<{code: string, severity: "warning" | "error", fieldPath: string, message: string, evidence: string, suggestedAction: string}>}} RuleCheckReport */
/** @typedef {{status: ReportStatus, scenarios: Array<{scenarioId: string, userInput: string, characterResponse: string, issues: string[], evidence: string[], suggestedFields: string[]}>, summary: string}} SimulationReport */

/**
 * @typedef {object} GenerationRecord
 * @property {string} id
 * @property {string} task
 * @property {string} target
 * @property {"completed" | "cancelled" | "failed"} status
 * @property {string} createdAt
 */

/**
 * 可在任意生成阶段保存的项目；尚未生成的对象使用 null，集合使用空数组。
 * @typedef {object} ProjectDocument
 * @property {string} id
 * @property {string} title
 * @property {import("./character.js").CreativeSeed | null} seed
 * @property {import("./character.js").CreativeBrief | null} brief
 * @property {import("./character.js").ConceptCandidate[]} concepts
 * @property {string | null} selectedConceptId
 * @property {import("./character.js").CharacterDraft | null} character
 * @property {import("./world-story.js").WorldBible | null} worldBible
 * @property {import("./world-story.js").StoryDraft | null} storyDraft
 * @property {RuleCheckReport | null} ruleReport
 * @property {SimulationReport | null} simulationReport
 * @property {import("./platform.js").PlatformPack[]} platformPacks
 * @property {GenerationRecord[]} generationRecords
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {object} CharacterProject
 * @property {string} id
 * @property {string} title
 * @property {import("./character.js").CreativeBrief} brief
 * @property {import("./character.js").ConceptCandidate[]} concepts
 * @property {string} selectedConceptId
 * @property {import("./character.js").CharacterDraft} character
 * @property {RuleCheckReport} ruleReport
 * @property {SimulationReport} simulationReport
 * @property {import("./platform.js").PlatformPack[]} platformPacks
 * @property {string} createdAt
 * @property {string} updatedAt
 */

const REPORT_STATUSES = ["pass", "warning", "fail"];

/** @param {unknown} value @param {string} path */
export function validateRuleCheckReport(value, path) {
  const report = assertObject(value, path);
  assertExactKeys(report, ["status", "issues"], path);
  assertEnum(report.status, REPORT_STATUSES, `${path}.status`);
  const issues = assertArray(report.issues, `${path}.issues`);
  issues.forEach((value, index) => {
    const issuePath = `${path}.issues[${index}]`;
    const issue = assertObject(value, issuePath);
    assertExactKeys(issue, ["code", "severity", "fieldPath", "message", "evidence", "suggestedAction"], issuePath);
    assertString(issue.code, `${issuePath}.code`);
    assertEnum(issue.severity, ["warning", "error"], `${issuePath}.severity`);
    for (const key of ["fieldPath", "message", "evidence", "suggestedAction"]) assertString(issue[key], `${issuePath}.${key}`);
  });
}

/** @param {unknown} value @param {string} path */
export function validateSimulationReport(value, path) {
  const report = assertObject(value, path);
  assertExactKeys(report, ["status", "scenarios", "summary"], path);
  assertEnum(report.status, REPORT_STATUSES, `${path}.status`);
  const scenarios = assertArray(report.scenarios, `${path}.scenarios`);
  if (scenarios.length !== 8) fail(`${path}.scenarios`, "expected exactly 8 scenarios");
  const ids = new Set();
  scenarios.forEach((value, index) => {
    const scenarioPath = `${path}.scenarios[${index}]`;
    const scenario = assertObject(value, scenarioPath);
    assertExactKeys(scenario, ["scenarioId", "userInput", "characterResponse", "issues", "evidence", "suggestedFields"], scenarioPath);
    const id = assertString(scenario.scenarioId, `${scenarioPath}.scenarioId`);
    assertString(scenario.userInput, `${scenarioPath}.userInput`);
    assertString(scenario.characterResponse, `${scenarioPath}.characterResponse`);
    assertStringArray(scenario.issues, `${scenarioPath}.issues`);
    assertStringArray(scenario.evidence, `${scenarioPath}.evidence`);
    assertStringArray(scenario.suggestedFields, `${scenarioPath}.suggestedFields`);
    if (ids.has(id)) fail(`${scenarioPath}.scenarioId`, "expected a unique scenario id");
    ids.add(id);
  });
  assertString(report.summary, `${path}.summary`);
}

/** @param {unknown} value @param {string} path */
export function validateGenerationRecord(value, path) {
  const record = assertObject(value, path);
  assertExactKeys(record, ["id", "task", "target", "status", "createdAt"], path);
  assertString(record.id, `${path}.id`);
  assertString(record.task, `${path}.task`);
  assertString(record.target, `${path}.target`);
  assertEnum(record.status, ["completed", "cancelled", "failed"], `${path}.status`);
  assertString(record.createdAt, `${path}.createdAt`);
}

function validateSelectedConcept(selectedConceptId, concepts, path) {
  if (!concepts.some((candidate) => candidate.id === selectedConceptId)) {
    fail(path, "expected an id present in concepts");
  }
}

/** @param {unknown} value @param {string} path */
export function validateProjectDocument(value, path) {
  const project = assertObject(value, path);
  const keys = ["id", "title", "seed", "brief", "concepts", "selectedConceptId", "character", "worldBible", "storyDraft", "ruleReport", "simulationReport", "platformPacks", "generationRecords", "createdAt", "updatedAt"];
  assertExactKeys(project, keys, path);
  assertString(project.id, `${path}.id`);
  assertString(project.title, `${path}.title`);
  if (project.seed !== null) validateCreativeSeed(project.seed, `${path}.seed`);
  if (project.brief !== null) validateCreativeBrief(project.brief, `${path}.brief`);
  const concepts = assertArray(project.concepts, `${path}.concepts`);
  if (concepts.length !== 0 && concepts.length !== 3) fail(`${path}.concepts`, "expected an empty array or exactly 3 concept candidates");
  if (concepts.length === 3) {
    validateConceptCandidates(concepts, `${path}.concepts`);
  } else {
    concepts.forEach((candidate, index) => validateConceptCandidate(candidate, `${path}.concepts[${index}]`));
  }
  if (project.selectedConceptId !== null) {
    const selectedId = assertString(project.selectedConceptId, `${path}.selectedConceptId`);
    validateSelectedConcept(selectedId, /** @type {Array<Record<string, unknown>>} */ (concepts), `${path}.selectedConceptId`);
  }
  if (project.character !== null) validateCharacterDraft(project.character, `${path}.character`);
  if (project.worldBible !== null) validateWorldBible(project.worldBible, `${path}.worldBible`);
  if (project.storyDraft !== null) validateStoryDraft(project.storyDraft, `${path}.storyDraft`);
  if (project.ruleReport !== null) validateRuleCheckReport(project.ruleReport, `${path}.ruleReport`);
  if (project.simulationReport !== null) validateSimulationReport(project.simulationReport, `${path}.simulationReport`);
  const packs = assertArray(project.platformPacks, `${path}.platformPacks`);
  packs.forEach((pack, index) => validatePlatformPack(pack, `${path}.platformPacks[${index}]`));
  const records = assertArray(project.generationRecords, `${path}.generationRecords`);
  records.forEach((record, index) => validateGenerationRecord(record, `${path}.generationRecords[${index}]`));
  assertString(project.createdAt, `${path}.createdAt`);
  assertString(project.updatedAt, `${path}.updatedAt`);
}

/** @param {unknown} value @returns {RuleCheckReport} */
export function assertRuleCheckReport(value) {
  validateRuleCheckReport(value, "RuleCheckReport");
  return /** @type {RuleCheckReport} */ (value);
}

/** @param {unknown} value @returns {SimulationReport} */
export function assertSimulationReport(value) {
  validateSimulationReport(value, "SimulationReport");
  return /** @type {SimulationReport} */ (value);
}

/** @param {unknown} value @returns {GenerationRecord} */
export function assertGenerationRecord(value) {
  validateGenerationRecord(value, "GenerationRecord");
  return /** @type {GenerationRecord} */ (value);
}

/** @param {unknown} value @returns {ProjectDocument} */
export function assertProjectDocument(value) {
  validateProjectDocument(value, "ProjectDocument");
  return /** @type {ProjectDocument} */ (value);
}

/** @param {unknown} value @returns {CharacterProject} */
export function assertCharacterProject(value) {
  const project = assertObject(value, "CharacterProject");
  assertExactKeys(project, ["id", "title", "brief", "concepts", "selectedConceptId", "character", "ruleReport", "simulationReport", "platformPacks", "createdAt", "updatedAt"], "CharacterProject");
  assertString(project.id, "CharacterProject.id");
  assertString(project.title, "CharacterProject.title");
  validateCreativeBrief(project.brief, "CharacterProject.brief");
  validateConceptCandidates(project.concepts, "CharacterProject.concepts");
  const selectedId = assertString(project.selectedConceptId, "CharacterProject.selectedConceptId");
  validateSelectedConcept(selectedId, /** @type {Array<Record<string, unknown>>} */ (project.concepts), "CharacterProject.selectedConceptId");
  validateCharacterDraft(project.character, "CharacterProject.character");
  validateRuleCheckReport(project.ruleReport, "CharacterProject.ruleReport");
  validateSimulationReport(project.simulationReport, "CharacterProject.simulationReport");
  const packs = assertArray(project.platformPacks, "CharacterProject.platformPacks");
  packs.forEach((pack, index) => validatePlatformPack(pack, `CharacterProject.platformPacks[${index}]`));
  assertString(project.createdAt, "CharacterProject.createdAt");
  assertString(project.updatedAt, "CharacterProject.updatedAt");
  return /** @type {CharacterProject} */ (value);
}
