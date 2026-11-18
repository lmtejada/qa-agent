---
paths:
  - "src/**/*.ts"
---

# TypeScript standards

Applies when writing or changing TypeScript in `src/`. Most of these rules are enforced by
ESLint (the edit hook reports violations right away) and `tsc`; when a check fails, fix the
code, never the check. Architecture, layers, errors and dependency injection are in `CLAUDE.md`.

## Module structure (enforced)

- **No code in a file's body.** At the top level, a file may only contain imports, types,
  function declarations, and `const` literal data. The only exception is the entry points
  (`src/cli/index.ts`, `src/server/index.ts`), whose last line is `await main();`. Test files
  may call `test()`/`describe()` at the top level.
- **Files export only functions or data** (constants and types). No classes, no `let`/`var` at
  the top level, no values computed when the file loads: if it needs a function call (reading
  env vars, creating a client, `z.object(...)`), put it behind a function.
- **Separate logic from I/O.** `console` is allowed only in `src/cli/` and `src/server/`. Other
  code returns values or `Result`s; it doesn't print or call `process.exit`.
- **Small, focused functions:** at most 50 lines, 3 parameters, nesting depth 3, cyclomatic
  complexity 10. Split the function rather than raising a limit.
- **One responsibility per file.** Name files after what they do, in kebab-case
  (`user-input.ts`, `test-generator.ts`).
- **Packages stay in their layer:**
  - `@ai-sdk/*` provider packages only in `src/ai/*-client.ts`.
  - Runtime imports from `ai` (`generateText`, ...) only in `src/ai/` and tests; elsewhere,
    `import type` only.
  - `fastify`, `@fastify/*` and `node:http(s)` only in `src/server/`.
- **`process.env`** only in `src/shared/config.ts`; **`process.exit`** only in the entry points.

## Imports (enforced)

- ESM only. Imports of project files end in `.js` (`#/foo.js`), even though the file is
  `foo.ts`.
- Import from `src/` only via the `#/` alias (`#/shared/config.js`). Relative imports (`./`,
  `../`) are rejected.
- Use `import type` for type-only imports (`verbatimModuleSyntax` is on).
- Order: builtins, external, `#/` internal, then `import type`.

## Types

- Strict TypeScript is on (`tsconfig.json`); don't weaken it.
- Never use `any` unless justified in a comment on the same line. Use `unknown` for untrusted
  data and narrow it.
- No non-null assertions (`value!`); narrow with a check instead.
- `type`, not `interface`, for object types.
- Explicit return types on exported functions.
- Named exports only; no `export default`.
- Validate external data at runtime with zod; don't hide a mismatch behind an `as` cast.

## Style

- Prefer `const`, immutable data, and pure functions (same input, same output, no side effects).
- Use `async`/`await`; never leave a promise un-awaited (enforced).
- `===` only, and don't reassign parameters (enforced).
- Prefer early returns over nested `if`/`else`.
- Descriptive names: functions are verbs in camelCase (`generateTestCases`), constants are
  `UPPER_SNAKE_CASE`, types are `PascalCase`.
- No magic numbers or strings: give them a named `UPPER_SNAKE_CASE` constant.
- Keep side effects (I/O, network, clock, randomness) at the boundaries; business logic stays
  pure.
- Avoid duplicated business logic: put a rule in one place and call it.
- Don't create utility functions without a second real caller; a one-off helper belongs next to
  its only use.
