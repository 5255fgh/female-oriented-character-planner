# Mandatory Project Rules

## Source Of Truth

- Before editing, read `PROJECT_SPEC.md` and `src/contracts.js`.
- The task prompt, `PROJECT_SPEC.md`, and `src/contracts/` are authoritative.
- Never rename or silently extend public fields and interfaces.

## Scope And Ownership

- Implement only the current task and modify only its assigned paths.
- `docs/parallel/MODULE_OWNERSHIP.md` is the canonical ownership map; cross-module edits are forbidden.
- Shared contract changes are owned by foundation/integration tasks. Other tasks record them under `Requested shared change` in their handoff.
- Do not add unrelated features, frameworks, dependencies, analytics, logging systems, design systems, or test frameworks.

## Pull Requests And Handoffs

- Create feature branches from the latest `integration/intelligent-v2`.
- Target every feature PR at `integration/intelligent-v2`, never directly at `main`.
- Every module creates `docs/handoffs/<module>.md` from `docs/handoffs/TEMPLATE.md` and records APIs, migrations, verification, integration notes, shared-change requests, and real open issues.

## Stack And LLM

- Use direct Vanilla JavaScript ES modules and Vite; avoid unnecessary classes.
- Structured model responses are raw JSON, validated before use, with at most one retry for empty or invalid JSON.
- Field regeneration returns only `{ fieldPath, value }` and never overwrites the complete character.

## Secrets

- Never commit API keys, put secrets in `VITE_` variables, or store keys in IndexedDB/localStorage.

## Verification And Delivery

- Run `npm run smoke` and `npm run build`; fix failures caused by the current task.
- Commit all task changes.
- Final responses only report branch, commit hash, files changed, commands run, and a real blocker if one exists.
