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

## Decision

- We will organize `src/` in layers with one-way dependencies: interfaces (`cli/`, `server/`) →
  `workflows/` → capabilities (`ai/`, `integrations/`, `automation/`, `reporting/`) →
  `validation/` → `shared/`. Capabilities don't import each other; workflows combine them.
- We will keep modules function-only: no classes, no code in a file's body, and no values
  computed at load time. Entry points end with `await main();`.
- We will inject dependencies from the entry points (the composition root), as parameters or a
  `<Name>Deps` object.
- We will build external clients as `create<System>Client(options)` returning a function-typed
  object. They get config through `options`, validate responses with zod, and return `Result`
  for expected failures.
- We will return `Result<T>` (`src/shared/result.ts`) for expected failures and throw only for
  bugs, caught at the entry points or by the server's error middleware.
- We will enforce these rules with tools:
  - ESLint: `import-x/no-restricted-paths` layer zones, `import-x/no-cycle`,
    `no-restricted-syntax`, `no-default-export`, explicit return types, `no-console` outside
    interfaces, and size limits (50 lines, 3 params, depth 3, complexity 10).
  - A Claude Code hook that lints each edited file.
  - `npm test` (`node:test`, co-located `*.test.ts`) in `npm run check` and CI.
- We considered keeping the rules only in `CLAUDE.md` and rejected it because nothing enforces
  them.
- We considered one central constants file and rejected it because it turns into a dumping
  ground. Config holds per-environment values, `shared/constants.ts` cross-folder ones, and
  modules keep their own.

## Consequences

- Rule violations fail at edit time, at commit, and in CI, with a message pointing to the rule.
- Clients and workflows are testable with fakes and reusable outside this repo.
- More ceremony: `Deps` objects, `Result` checks, and splitting functions that hit size limits.
- A new top-level folder that forms a layer must be added to the layer lists in
  `eslint.config.ts`.
- Choosing an HTTP framework and middleware implementation is left for a future ADR.
