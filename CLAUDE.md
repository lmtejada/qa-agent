# CLAUDE.md

Guidance for Claude (and other AI assistants) working in this repository.

## Project

QA agent: takes a user story and asks Gemini (Vercel AI SDK, `ai` + `@ai-sdk/google`) for test
cases. Two entry points share the same logic: a terminal loop (`src/cli/`) and an HTTP server
(`src/server/`).

TypeScript/Node.js project. Node runs the compiled output: `src/` → `tsc` → `dist/`.
Node version is pinned in `.nvmrc` (24 LTS) and enforced via `engines` + `engine-strict`.

## Key commands

```sh
npm run dev         # run the terminal app with tsx in watch mode
npm run dev:server  # run the HTTP server with tsx in watch mode
npm start           # run the compiled terminal app from dist/ (after npm run build)
npm run serve       # run the compiled HTTP server from dist/ (after npm run build)
npm test            # run the tests (node:test, src/**/*.test.ts)
npm run check       # everything CI runs — must pass before you finish a task
npm run lint:fix    # auto-fix lint issues
npm run format      # auto-format
```

## How the rules are enforced

Most rules below are checked by tools, not just written down. If a check fails, change the code
to follow the rule; don't disable or weaken the check.

| Check                       | Runs                                      | Enforces                                                         |
| --------------------------- | ----------------------------------------- | ---------------------------------------------------------------- |
| ESLint (`eslint.config.ts`) | Claude hook on every edit, pre-commit, CI | Layers, module structure, size limits, exports, types, `console` |
| `tsc` strict                | pre-push, CI                              | Types                                                            |
| `npm test`                  | CI, `npm run check`                       | Behavior                                                         |
| Prettier                    | pre-commit, CI                            | Formatting                                                       |
| commitlint                  | commit-msg hook, PR title check           | Conventional Commits                                             |

The Claude hook (`.claude/settings.json` → `.claude/hooks/lint-edited-file.sh`) lints each file
under `src/` right after it's edited and reports violations back immediately.

## Architecture

### Layers

Dependencies point one way. ESLint (`import-x/no-restricted-paths`, `import-x/no-cycle`) rejects
imports that go against these arrows.

```text
interfaces   cli/  server/                    entry points; I/O; may import anything below
    │
workflows    workflows/                       combine capabilities into use cases
    │
capabilities ai/  integrations/  automation/  reporting/   independent of each other
    │
foundation   validation/  →  shared/          schemas; config, constants, errors, Result
```

- Interfaces never import each other, and nothing imports an interface.
- Capabilities never import each other. When a feature needs two of them (fetch a Jira story,
  then generate tests), write a workflow in `src/workflows/` that receives both as dependencies.
- `shared/` imports nothing from `src/`. `validation/` may import only `shared/`.

### Folders

Put new code in the folder that matches what it does. Create a folder only in the change that
first needs it (no empty placeholder folders).

| Folder              | What goes there                                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/cli/`          | Terminal interface. `index.ts` is an entry point.                                                                                                                   |
| `src/server/`       | HTTP interface: routes, middleware, request validation, responses. `index.ts` is an entry point.                                                                    |
| `src/workflows/`    | Use cases that combine capabilities, one file per use case (`generate-tests-from-jira.ts`).                                                                         |
| `src/ai/`           | Everything that calls a model: `<provider>-client.ts` per provider, one file per AI capability (`test-generator.ts`), and `prompts/<capability>.ts` for its prompt. |
| `src/integrations/` | One subfolder per external system (`jira/`, `zephyr/`), following the client pattern below.                                                                         |
| `src/automation/`   | Running generated tests (e.g. Playwright).                                                                                                                          |
| `src/reporting/`    | Building reports from results.                                                                                                                                      |
| `src/validation/`   | zod schemas for data that crosses a boundary (model output, API input), with types inferred from them.                                                              |
| `src/shared/`       | Code every layer may use: `config.ts`, `constants.ts`, `errors.ts`, `result.ts`.                                                                                    |

### Dependency injection and the composition root

- Each entry point is the **composition root**: it loads config once, creates every dependency
  (model, clients, logger), and passes them down. Nothing else reads config or creates clients.
- Functions receive dependencies as parameters. With more than two, pass one object typed as
  `<Name>Deps` (`generateTestsFromJira(input, { model, jira })`); `max-params` is 3.
- Depend on types, not implementations: a workflow takes a `JiraClient` type, so tests can pass a
  fake and another service can pass its own implementation.

### Clients for external systems

A client is the only code that talks to one external system. Shape it so other services can
reuse it unchanged:

- `src/integrations/<system>/client.ts` exports `type <System>Client` (an object type of
  functions) and `create<System>Client(options): <System>Client`. No classes.
- `options` carries everything the client needs: base URL, credentials, timeout, and optionally
  `fetch` (injectable for tests). Clients never read env vars or `config`.
- Validate every response with a zod schema (`schemas.ts`) and map external payloads to this
  project's types in `mapper.ts`. Callers never see the external API's raw shapes.
- Expected failures (not found, unauthorized, rate limited) return a `Result` with a stable error
  `code`; they don't throw.
- Set a timeout on every outbound request.
- AI providers follow the same idea: `src/ai/<provider>-client.ts` returns the AI SDK's
  `LanguageModel`, and only those files import a provider package.

### Constants, config and types

- **Values that may change per environment** (limits, timeouts, URLs, model IDs) are config: add
  them to the schema in `src/shared/config.ts` and `.env.example` with the `add-env-var` skill.
- **Constants used by more than one folder** go in `src/shared/constants.ts`.
- **Constants used by one module** stay in that module, as `UPPER_SNAKE_CASE`.
- **Types of data that crosses a boundary** (API bodies, model output, external payloads) are
  zod schemas in `src/validation/` (or the client's `schemas.ts`), with `type X = z.infer<...>`.
  Other types live next to the code that owns them.

### Errors

- Expected failures return `Result<T>` from `src/shared/result.ts` (`ok(value)`, `err({ code,
message })`). Use a `switch` on `error.code` to handle them; `switch-exhaustiveness-check` flags
  missing cases on unions.
- Unexpected failures (bugs, broken invariants) throw. Only the entry points and the server's
  error middleware catch them, log them, and turn them into a generic message.
- Never send internal error details (stack traces, upstream responses) to clients.

### HTTP server

- Route handlers only: validate input with zod, call a workflow or capability, map the result to
  a status code. No business logic in handlers.
- Cross-cutting concerns are middleware that wraps handlers, never code inside them:
  authentication, request IDs and logging, timeouts, and the error handler that catches
  everything else and returns a generic 500.
- Validate request bodies at the boundary, with size limits.
- Add a framework (Hono, Fastify, ...) or a new middleware layer only with an ADR first.

## Code structure (enforced by ESLint)

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

## Testing

- Tests live next to the code: `<file>.test.ts`, using `node:test` and `node:assert/strict`. They
  run from `src/` with tsx and are excluded from the build.
- New or changed behavior comes with tests. Test through the public functions, with fakes
  passed in as dependencies: `MockLanguageModelV4` from `ai/test` for models, a fake `fetch` or a
  fake client object for integrations. Tests never call real external services.
- Cover the expected failures (each `Result` error code), not only the happy path.

## Comments

- Don't comment what the code already says. Clear names replace most comments.
- Add a comment only for logic that is complex or non-obvious: a tricky algorithm, a
  workaround, a constraint from an external API, or a decision a reader would otherwise
  question. Explain **why**, not what.
- No JSDoc on every function. Add it to an exported function only when its behavior isn't
  clear from its name and types (e.g. edge cases, what it returns on empty input).
- Keep comments true: update or delete them when the code changes.

## TypeScript practices

- Named exports only; no `export default` (enforced).
- Never use `any`. Use `unknown` for untrusted values and narrow them (zod for external data).
- Explicit return types on exported functions (enforced).
- `type`, not `interface`, for object types (enforced).
- Prefer `const`, immutable data, and pure functions (same input, same output, no side effects).
- Prefer early returns over nested `if`/`else`.
- No magic numbers or strings: give them a named `UPPER_SNAKE_CASE` constant.
- Naming: functions are verbs in camelCase (`generateTestCases`), constants are
  `UPPER_SNAKE_CASE`, types are `PascalCase`.
- Use `async`/`await`; never leave a promise un-awaited (enforced).
- `===` only, and don't reassign parameters (enforced).

## LLM and agent practices

- Each capability's prompt lives in `src/ai/prompts/<capability>.ts`: the instructions as an
  exported `UPPER_SNAKE_CASE` string constant, and a `build...Prompt()` function that wraps the
  user's input. Review prompt changes like code changes.
- Code depends on the AI SDK's `LanguageModel` type, never on a specific provider. Only
  `<provider>-client.ts` files import a provider package (`@ai-sdk/google`, ...), and only the
  entry points decide which client to use. To add a provider, add its client file and its env
  vars; capability code doesn't change.
- Treat everything the model returns as untrusted input: validate structured output with zod
  before using it, and never execute or `eval` it.
- Treat the user's input as untrusted too: wrap it in clear delimiters in the prompt, and
  remind the model that it's data, not instructions (prompt injection).
- Never put secrets or personal data in prompts or logs.
- Tools for the agent (AI SDK `tool()`): one clear job each, a description that says what it
  does and when to use it, a strict zod `inputSchema` with `.describe()` on fields, concise
  structured results, and errors returned as data. Read-only by default; anything that writes
  or calls external systems needs user approval. Cap agent loops with `stopWhen`.
- Use a plain function (workflow) when the steps are fixed; use tools only when the model must
  decide what to do next.

## Conventions

- ESM only. Imports of project files **must** end in `.js` (`#/foo.js`), even though the file is `foo.ts`.
- Import from `src/` only via the `#/` alias (`#/shared/config.js`, defined in `package.json` `"imports"`). Relative imports (`./`, `../`) are rejected by ESLint.
- Use `import type` for type-only imports (`verbatimModuleSyntax` is on).
- Read env vars only through `src/shared/config.ts`; never use `process.env` elsewhere.
  New variables go in the zod schema and `.env.example`: use the `add-env-var` skill.
- Import order is enforced by `import-x/order`: builtins, external, `#/` internal, then `import type`.
- Commits and PR titles follow Conventional Commits (`feat: ...`, `fix(scope): ...`).
- Tooling goes in `devDependencies`. Keep runtime dependencies minimal.
- Use `npm` (lockfile is `package-lock.json`). No `npx` inside npm scripts.

## Don't change without asking

- `tsconfig.json` strictness flags, `module`/`target`, or the `#/*` alias (`package.json` `"imports"` + `customConditions`).
- ESLint rules or presets — fix the code instead of disabling rules. No `eslint-disable`
  comments without a reason in the same comment.
- The Claude hook in `.claude/settings.json` and `.claude/hooks/`.
- Git hooks in `.husky/`, and the `commitlint` and `lint-staged` keys in `package.json`.
- `.github/workflows/*`: action SHA pins, permissions, and the CI job name
  `Format and Type Check` (the `main` ruleset requires a check with that exact name).
- `.nvmrc` / `engines` / the `@types/node` major (keep all three on the same Node major), or adding new dependencies (especially runtime ones, or `dotenv`).
- `LICENSE`.

## Project skills

In `.claude/skills/`:

- `add-env-var`: add, rename or remove an env variable everywhere it must be declared.
- `prepare-pr`: run the checks, review the diff and commits, and draft the PR description.
- `write-adr`: turn a decision from the conversation into a numbered ADR in `docs/adr/`.

## Decisions

Architecture decisions are recorded in `docs/adr/`. Add a new ADR for significant changes, using the `write-adr` skill.
ADR 0002 records the architecture and enforcement described in this file.
