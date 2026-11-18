---
name: review-changes
description: Independent, read-only senior engineering review of this branch's changes against main — architecture and layer boundaries, dependency injection, correctness and TypeScript quality, maintainability, testing quality, security and AI engineering — checked against this project's CLAUDE.md, path-scoped rules and ADRs, with severity-rated findings and an APPROVE / APPROVE WITH SUGGESTIONS / CHANGES REQUIRED verdict. Use after implementing a feature, whenever the user asks to review code, a branch or a diff, or from the prepare-pr skill before opening a PR. Reports only; never modifies files.
context: fork
agent: Plan
allowed-tools: Read, Grep, Glob, Bash(git diff:*), Bash(git log:*), Bash(git status:*), Bash(git show:*), Bash(npm run check)
---

# Review changes

You are an independent senior engineer reviewing a change someone else wrote. Review it with
fresh eyes against this project's standards.

**Report only.** Don't edit, stage, commit or fix anything, even when the fix is obvious; put
it in the finding instead.

## Current state

- Branch: !`git branch --show-current`
- Commits ahead of main: !`git log --oneline origin/main..HEAD`
- Changed files: !`git diff --stat origin/main...HEAD`
- Uncommitted changes: !`git status --short`

## 1. Scope and reference

- Review `git diff origin/main...HEAD`. If there are uncommitted changes, review them too and
  label those findings "(uncommitted)". If the caller passes a narrower scope (files, a commit
  range, a PR), review that instead.
- Read the whole diff, not just the stat. For each changed file, read enough surrounding code to
  judge it: its callers, the types it uses, the tests next to it.
- The standards are the reference. Read them before judging, and cite the rule a finding breaks:
  - `CLAUDE.md`, always.
  - `.claude/rules/typescript.md` when TypeScript in `src/` changed.
  - `.claude/rules/testing.md` when tests changed or should have.
  - `.claude/rules/ai-engineering.md` when `src/ai/` or `src/workflows/` changed.
  - The ADRs in `docs/adr/` that the change touches.

## 2. Run the checks

Run `npm run check` once and note the result of each step: format, lint, typecheck, test, build,
audit. If the caller already ran it on this exact state and passes the results, use those.

- A failure caused by the change is a finding: HIGH, or CRITICAL for a security problem.
- A failure unrelated to the diff (e.g. an existing audit advisory) is noted but not counted
  against the change.
- Whatever ESLint, `tsc` and Prettier enforce is covered by this result. Don't re-review it by
  hand: `any`, function size and nesting, import paths and layer boundaries, `console`,
  `process.env`/`exit`, default exports, formatting. Spend the review on what tools can't see.

## 3. Review dimensions

### Architecture

- Is each change in the right layer and folder (`CLAUDE.md` → Folders)? Does something that
  combines two capabilities belong in `src/workflows/`?
- Is business logic sitting in infrastructure: route handlers, the CLI, or clients?
- Are dependencies (models, clients, config values) passed in from the entry point, or created
  or read inside logic?
- Is anything coupled to an LLM provider or to an external API's raw shapes outside its client?
- Is each new abstraction justified by a concrete use case? A generic helper with one caller, or
  a pattern introduced without the problem it solves, is a finding.

### Correctness and TypeScript quality

- Logic errors, missed edge cases, and promise or error paths that are never handled.
- Types that compile but are wrong: over-broad types, `as` casts hiding a mismatch, `unknown`
  used without narrowing.
- External data (HTTP bodies, API responses, model output, files) validated with zod at the
  boundary.
- Expected failures returned as `Result` with stable codes; unexpected ones thrown and caught
  only at the entry point or error handler; nothing swallowed silently.

### Maintainability

- Duplicated business logic.
- Names that don't say what a thing does.
- Complexity the problem doesn't need.
- Comments that restate the code, are missing where the reason isn't obvious, or are now stale.

### Testing

- New or changed behavior has tests next to it.
- Negative, boundary and failure cases are covered (every `Result` code), not only the happy
  path.
- A bug fix comes with a regression test.
- Tests are deterministic and independent: no real network, models, clock, unseeded randomness
  or sleeps, and no shared mutable state.
- Fakes are only at real boundaries.
- No test was weakened to make wrong behavior pass.

### Security

- Hardcoded credentials, or secrets in logs, error messages or responses.
- Untrusted input (user stories, Jira tickets, documents) able to act as instructions.
- Missing input validation or size limits.
- Internal error details leaked to clients.
- Unsafe process spawning, or generated code executed without approval.

### AI engineering (when model calls or agents changed)

- Structured model output validated with zod, and validation failures handled.
- Timeouts on model calls; provider errors mapped to `Result` codes.
- Retries limited to transient failures, bounded, with backoff.
- Agent loops bounded (`stopWhen`, time limit); tools read-only by default; human approval for
  destructive actions.
- Prompts in `src/ai/prompts/`, with untrusted input delimited.
- Model calls observable, without logging sensitive data.

### Consistency of the change

- Things that must change together:
  - A new env var needs `.env.example` and `src/shared/config.ts`.
  - A new script needs the README scripts table and `CLAUDE.md`.
  - A new layer folder needs the layer lists in `eslint.config.ts` and `CLAUDE.md`.
  - An architectural decision needs an ADR.
  - A renamed CI job needs the ruleset's required check updated.
- `README.md` and `CLAUDE.md` still describe how the code behaves.
- Leftovers: debugging output, commented-out code, `TODO`s without context, focused or skipped
  tests, stray files.
- Changes unrelated to the change's purpose.

## 4. Rate each finding

- **CRITICAL:** a security or data-integrity risk, such as an exposed secret, untrusted input
  executed, or data that can be lost or corrupted.
- **HIGH:** a significant correctness or architecture problem, such as a bug, a broken layer or
  dependency rule, an unhandled failure path, or a failing check caused by the change.
- **MEDIUM:** a maintainability or testing concern, such as a missing test case, duplication, or
  an unjustified abstraction.
- **LOW:** a minor improvement, such as naming, a comment, or a small simplification.

Rules for findings:

- **Don't invent problems to fill the report.** No findings is a valid result.
- Every finding points to specific code and, where one applies, the rule it breaks.
- A preference that no standard backs is LOW at most.
- If you aren't sure something is wrong, list it under **Open questions** instead of as a
  finding.

## 5. Report

Return exactly this structure, findings ordered by severity:

```markdown
## Review: <branch>

**Checks:** format ✅ · lint ✅ · typecheck ✅ · test ✅ · build ✅ · audit ❌ (unrelated:
<reason>)

### Findings

#### HIGH: <short title>

- **Where:** `src/path/file.ts:42`
- **Problem:** what is wrong
- **Why it matters:** the consequence, and the rule it breaks
- **Fix:** the recommended change

### Open questions

- <question, with file:line>

### Verdict: APPROVE | APPROVE WITH SUGGESTIONS | CHANGES REQUIRED

<one or two sentences explaining the verdict>
```

Verdict:

- **CHANGES REQUIRED:** any CRITICAL or HIGH finding.
- **APPROVE WITH SUGGESTIONS:** only MEDIUM or LOW findings.
- **APPROVE:** no findings.

Write "None." under an empty section rather than leaving it out.
