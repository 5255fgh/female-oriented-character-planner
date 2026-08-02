import {
  assertArray,
  assertEnum,
  assertExactKeys,
  assertObject,
  assertString,
  assertStringArray,
  fail,
} from "./common.js";

/**
 * @typedef {object} CreativeSeed
 * @property {string} text
 */

/**
 * @typedef {"free_character" | "dead_rival" | "image_shape"} OutputMode
 * @typedef {"low" | "medium" | "high"} InitiativeLevel
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
 * @typedef {object} CharacterDraft
 * @property {{id: string, name: string, createdAt: string, updatedAt: string}} meta
 * @property {{name: string, oneLiner: string, appearance: string, tags: string[]}} publicInfo
 * @property {{identity: string, background: string, currentGoal: string, secret: string, desire: string, fear: string, contradiction: string, concreteBehaviors: string[], initiativeRules: string[], forbiddenBehaviors: string[]}} persona
 * @property {{initialRelation: string, attractionConditions: string[], stages: Array<{name: string, trigger: string, behavior: string}>, conflictPattern: string, repairPattern: string}} relationship
 * @property {{addressStyle: string, sentenceStyle: string, replyLength: string, actionNarration: string, emotionalExpression: string, bannedPhrases: string[], examples: Array<{user: string, character: string}>}} dialogueStyle
 * @property {{plotOpening: string, dailyOpening: string, tensionOpening: string}} openings
 * @property {{appearancePrompt: string, styleSuggestion: string}} imageDesign
 */

const CREATIVE_BRIEF_KEYS = [
  "platform", "outputMode", "characterGender", "ageRange", "worldSetting",
  "characterIdentity", "coreExperiences", "relationshipType", "coreConflict",
  "personalityContradiction", "initiativeLevel", "interactionTone", "boundaries",
  "bannedBehaviors", "extraNotes",
];

const CONCEPT_CANDIDATE_KEYS = [
  "id", "name", "oneLiner", "coreExperience", "initialRelation", "coreConflict",
  "uniqueBehavior", "firstInteraction", "longTermPotential", "differenceSummary",
];

/** @param {unknown} value @param {string} path */
export function validateCreativeSeed(value, path) {
  const seed = assertObject(value, path);
  assertExactKeys(seed, ["text"], path);
  if (assertString(seed.text, `${path}.text`).trim().length === 0) {
    fail(`${path}.text`, "expected a non-empty string");
  }
}

/** @param {unknown} value @param {string} path */
export function validateCreativeBrief(value, path) {
  const brief = assertObject(value, path);
  assertExactKeys(brief, CREATIVE_BRIEF_KEYS, path);
  assertEnum(brief.platform, ["maoxiang"], `${path}.platform`);
  assertEnum(brief.outputMode, ["free_character", "dead_rival", "image_shape"], `${path}.outputMode`);
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

/** @param {unknown} value @param {string} path */
export function validateConceptCandidate(value, path) {
  const candidate = assertObject(value, path);
  assertExactKeys(candidate, CONCEPT_CANDIDATE_KEYS, path);
  for (const key of CONCEPT_CANDIDATE_KEYS) {
    assertString(candidate[key], `${path}.${key}`);
  }
}

/** @param {unknown} value @param {string} path */
export function validateConceptCandidates(value, path) {
  const candidates = assertArray(value, path);
  if (candidates.length !== 3) {
    fail(path, "expected exactly 3 concept candidates");
  }
  const ids = new Set();
  for (let index = 0; index < candidates.length; index += 1) {
    validateConceptCandidate(candidates[index], `${path}[${index}]`);
    const id = /** @type {Record<string, unknown>} */ (candidates[index]).id;
    if (ids.has(id)) {
      fail(`${path}[${index}].id`, "expected a unique candidate id");
    }
    ids.add(id);
  }
}

/** @param {unknown} value @param {string} path */
export function validateCharacterDraft(value, path) {
  const character = assertObject(value, path);
  assertExactKeys(character, ["meta", "publicInfo", "persona", "relationship", "dialogueStyle", "openings", "imageDesign"], path);

  const meta = assertObject(character.meta, `${path}.meta`);
  assertExactKeys(meta, ["id", "name", "createdAt", "updatedAt"], `${path}.meta`);
  for (const key of ["id", "name", "createdAt", "updatedAt"]) assertString(meta[key], `${path}.meta.${key}`);

  const publicInfo = assertObject(character.publicInfo, `${path}.publicInfo`);
  assertExactKeys(publicInfo, ["name", "oneLiner", "appearance", "tags"], `${path}.publicInfo`);
  for (const key of ["name", "oneLiner", "appearance"]) assertString(publicInfo[key], `${path}.publicInfo.${key}`);
  assertStringArray(publicInfo.tags, `${path}.publicInfo.tags`);

  const persona = assertObject(character.persona, `${path}.persona`);
  const personaKeys = ["identity", "background", "currentGoal", "secret", "desire", "fear", "contradiction", "concreteBehaviors", "initiativeRules", "forbiddenBehaviors"];
  assertExactKeys(persona, personaKeys, `${path}.persona`);
  for (const key of personaKeys.slice(0, 7)) assertString(persona[key], `${path}.persona.${key}`);
  for (const key of personaKeys.slice(7)) assertStringArray(persona[key], `${path}.persona.${key}`);

  const relationship = assertObject(character.relationship, `${path}.relationship`);
  assertExactKeys(relationship, ["initialRelation", "attractionConditions", "stages", "conflictPattern", "repairPattern"], `${path}.relationship`);
  assertString(relationship.initialRelation, `${path}.relationship.initialRelation`);
  assertStringArray(relationship.attractionConditions, `${path}.relationship.attractionConditions`);
  const stages = assertArray(relationship.stages, `${path}.relationship.stages`);
  stages.forEach((value, index) => {
    const stagePath = `${path}.relationship.stages[${index}]`;
    const stage = assertObject(value, stagePath);
    assertExactKeys(stage, ["name", "trigger", "behavior"], stagePath);
    for (const key of ["name", "trigger", "behavior"]) assertString(stage[key], `${stagePath}.${key}`);
  });
  assertString(relationship.conflictPattern, `${path}.relationship.conflictPattern`);
  assertString(relationship.repairPattern, `${path}.relationship.repairPattern`);

  const dialogueStyle = assertObject(character.dialogueStyle, `${path}.dialogueStyle`);
  const dialogueKeys = ["addressStyle", "sentenceStyle", "replyLength", "actionNarration", "emotionalExpression", "bannedPhrases", "examples"];
  assertExactKeys(dialogueStyle, dialogueKeys, `${path}.dialogueStyle`);
  for (const key of dialogueKeys.slice(0, 5)) assertString(dialogueStyle[key], `${path}.dialogueStyle.${key}`);
  assertStringArray(dialogueStyle.bannedPhrases, `${path}.dialogueStyle.bannedPhrases`);
  const examples = assertArray(dialogueStyle.examples, `${path}.dialogueStyle.examples`);
  examples.forEach((value, index) => {
    const examplePath = `${path}.dialogueStyle.examples[${index}]`;
    const example = assertObject(value, examplePath);
    assertExactKeys(example, ["user", "character"], examplePath);
    assertString(example.user, `${examplePath}.user`);
    assertString(example.character, `${examplePath}.character`);
  });

  const openings = assertObject(character.openings, `${path}.openings`);
  assertExactKeys(openings, ["plotOpening", "dailyOpening", "tensionOpening"], `${path}.openings`);
  for (const key of ["plotOpening", "dailyOpening", "tensionOpening"]) assertString(openings[key], `${path}.openings.${key}`);

  const imageDesign = assertObject(character.imageDesign, `${path}.imageDesign`);
  assertExactKeys(imageDesign, ["appearancePrompt", "styleSuggestion"], `${path}.imageDesign`);
  assertString(imageDesign.appearancePrompt, `${path}.imageDesign.appearancePrompt`);
  assertString(imageDesign.styleSuggestion, `${path}.imageDesign.styleSuggestion`);
}

/** @param {unknown} value @returns {CreativeSeed} */
export function assertCreativeSeed(value) {
  validateCreativeSeed(value, "CreativeSeed");
  return /** @type {CreativeSeed} */ (value);
}

/** @param {unknown} value @returns {CreativeBrief} */
export function assertCreativeBrief(value) {
  validateCreativeBrief(value, "CreativeBrief");
  return /** @type {CreativeBrief} */ (value);
}

/** @param {unknown} value @returns {ConceptCandidate[]} */
export function assertConceptCandidates(value) {
  validateConceptCandidates(value, "ConceptCandidates");
  return /** @type {ConceptCandidate[]} */ (value);
}

/** @param {unknown} value @returns {CharacterDraft} */
export function assertCharacterDraft(value) {
  validateCharacterDraft(value, "CharacterDraft");
  return /** @type {CharacterDraft} */ (value);
}
