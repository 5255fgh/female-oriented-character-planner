# Mandatory Project Rules

## Source of truth
- Before editing, read PROJECT_SPEC.md and src/contracts.js.
- The task prompt, PROJECT_SPEC.md and src/contracts.js are authoritative.
- Never rename or silently extend public fields and interfaces.

## Scope
- Implement only the current task.
- Modify only files explicitly assigned to the current Worktree.
- Do not add unrelated features, future plans, analytics, logging systems, design systems or test frameworks.
- Do not edit package.json, PROJECT_SPEC.md or src/contracts.js outside the foundation/final-integration task.
- Do not add dependencies after the foundation commit.

## Stack
- Vanilla JavaScript and Vite only.
- No React, Vue, TypeScript, backend framework, LangChain, Agent framework, vector database or cloud database.
- Keep functions direct and avoid unnecessary classes.

## LLM
- Structured responses must be raw JSON, not Markdown fences.
- Validate model JSON before use.
- Retry at most once for empty or invalid JSON.
- Field regeneration returns only { fieldPath, value }.
- Never overwrite the complete character during field regeneration.

## Secrets
- Never commit API keys.
- Never place secrets in VITE_ variables.
- Never store API keys in IndexedDB or localStorage.

## Verification
- Run npm run build.
- Run npm run smoke.
- Fix failures caused by the current task.
- Commit all changes.

## Final response
Only report branch, commit hash, files changed, commands run and a real blocker if one exists.
