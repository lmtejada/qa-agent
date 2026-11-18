# 2. Layered architecture with enforced code rules

- **Status:** Accepted
- **Date:** 2026-11-18

## Context

- The project will grow: Jira and Zephyr integrations, Playwright automation, reporting, more AI
  providers, and an HTTP server that has to stay stable.
- Clients for external systems should be reusable by other services, and all code should be
  testable without calling real APIs.
- The code rules lived only in `CLAUDE.md`. Nothing checked them, so new code (human or
  AI-written) could break them unnoticed.
- Most code is generated with Claude Code, so the rules must also reach the model at the moment
  it writes code, without loading every rule into every task.

## Decision

- We will organize `src/` in layers with one-way dependencies: interfaces (`cli/`, `server/`) →
  `workflows/` → capabilities (`ai/`, `integrations/`, `automation/`, `reporting/`) →
  `validation/` → `shared/` → `constants/` and `types/`. Capabilities don't import each other;
  workflows combine them.
- We will keep modules function-only: no classes, no code in a file's body, and no values
  computed at load time. Entry points end with `await main();`.
- We will inject dependencies from the entry points (the composition root), as parameters or a
  `<Name>Deps` object.
- We will build external clients as `create<System>Client(options)` returning a function-typed
  object. They get config through `options`, validate responses with zod, and return `Result`
  for expected failures.
- We will return `Result<T>` (`src/types/result.ts`, built with `ok()`/`err()` from
  `src/shared/result.ts`) for expected failures and throw only for
  bugs, caught at the entry points or by the server's error handler.
- We will put every rule in exactly one of three tiers, the strongest that can express it:
  1. **Enforced by tools.** Violations fail the edit hook, the commit or CI.
  2. **`CLAUDE.md`**, always loaded: principles that apply to every change.
  3. **`.claude/rules/*.md`**, loaded for matching paths: detailed how-to for one area.
- Tier 1 consists of:
  - ESLint layer zones (`import-x/no-restricted-paths`) and `import-x/no-cycle`.
  - ESLint module structure (`no-restricted-syntax`), `no-default-export` and explicit return
    types.
  - ESLint size limits: 50 lines, 3 params, depth 3, complexity 10.
  - ESLint package boundaries: `@ai-sdk/*` only in provider clients, runtime `ai` imports only in
    `src/ai/`, `fastify` and `node:http` only in `src/server/`.
  - ESLint process and safety rules: `process.env` only in config, `process.exit` only in entry
    points, no `exec`/`execSync`, no non-null assertions, `no-console` outside interfaces.
  - A Claude Code hook that lints each edited file.
  - `npm test` (`node:test`, co-located `*.test.ts`) in `npm run check` and CI.
- Tier 3 has two files:
  - `testing.md` for `src/**/*.test.ts`: tools, Arrange-Act-Assert, determinism, no sleeps,
    independent tests, fakes only at boundaries.
  - `ai-engineering.md` for `src/ai/**` and `src/workflows/**`: structured output, prompts,
    timeouts, transient-only retries, bounded agent loops, observability.
- Obligations that apply to every change stay in `CLAUDE.md`, even when their area has a rules
  file. For example, "new behavior comes with tests" and "model output is untrusted".
- We considered keeping the rules only in `CLAUDE.md` and rejected it because nothing enforces
  them.
- We considered putting everything in `CLAUDE.md` and rejected it because it loads every rule
  into every task, including test and AI detail irrelevant to most changes.
- We considered a `typescript.md` rules file for `src/**/*.ts` and rejected it:
  - That path matches almost every task, so scoping saves nothing.
  - About half its rules are already enforced by tools.
  - Its new bullets (no duplicated business logic, no one-off utilities) went into `CLAUDE.md`.
- We considered Vitest for unit tests and kept `node:test`: it needs no dependency and already
  runs in CI. Changing the runner needs its own ADR.
- We considered Playwright for this project's own tests and rejected it: Playwright is for
  `src/automation/` (running generated tests against applications under test). Our HTTP
  endpoints are tested with Fastify's `app.inject()`.
- We will keep constants and types used by more than one folder in dedicated `src/constants/`
  and `src/types/` folders, one file per module or concept, split into `<module>/` subfolders as
  they grow. Single-use ones stay in their module; zod-inferred types stay with their schema.
- We considered one central constants file and rejected it because it turns into a dumping
  ground. Per-module files in `src/constants/` keep each file small and owned.
- We considered moving every constant and type there, including single-use ones, and rejected
  it: it separates them from the only code that uses them, for no reuse benefit.

## Consequences

- Rule violations fail at edit time, at commit, and in CI, with a message pointing to the rule.
- Detailed testing and AI rules reach the model when it works on those files, without growing
  every task's context.
- Tiers 2 and 3 are guidance only. Judgment rules, like no business logic in route handlers, can
  still be broken without a failing check.
- A rule must live in one place. Copying it into both `CLAUDE.md` and a rules file lets them
  drift apart.
- Clients and workflows are testable with fakes and reusable outside this repo.
- More ceremony: `Deps` objects, `Result` checks, and splitting functions that hit size limits.
- A new top-level folder that forms a layer must be added to the layer lists in
  `eslint.config.ts`.
- The HTTP framework is Fastify. Its ADR is still to be written.
