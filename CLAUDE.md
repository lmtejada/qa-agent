# CLAUDE.md

Guidance for Claude (and other AI assistants) working in this repository.

## Project

CLI QA agent: reads a user story from the terminal and asks Gemini (Vercel AI SDK, `ai` +
`@ai-sdk/google`) for test cases. The prompt and model call live in `src/test-cases.ts`.

TypeScript/Node.js project. Node runs the compiled output: `src/` → `tsc` → `dist/`.
Node version is pinned in `.nvmrc` (24 LTS) and enforced via `engines` + `engine-strict`.

## Key commands

```sh
npm run dev         # run with tsx in watch mode
npm start           # run the compiled app from dist/ (after npm run build)
npm run check       # everything CI runs — must pass before you finish a task
npm run lint:fix    # auto-fix lint issues
npm run format      # auto-format
```

## Code structure (mandatory)

- **No code in a file's body.** All logic lives inside functions. At the top level, a file may
  only contain imports, type declarations, function declarations, and constant data.
- **Every `.ts`/`.js` file exports only functions or data** (constants and types). No classes,
  no mutable exported state, no exported objects that are computed when the file loads.
- **Constant data means literals:** strings, numbers, arrays and plain objects written out in
  the source (`const MAX_TEST_CASES = 10`, `const INSTRUCTIONS = "..."`). If a value needs a
  function call to produce (reading env vars, creating a client, parsing), put it behind a
  function (`loadConfig()`, `createModel(config)`).
- **The only exception** is the entry point `src/index.ts`, whose last line calls `main()`.
  Nothing else runs at the top level, so importing any other file never has side effects.
- **Separate logic from I/O.** Only `main()` (and functions it calls in `src/index.ts`) reads
  from the terminal, prints, or sets `process.exitCode`. Other functions return values or
  throw errors; they don't `console.log` or call `process.exit`.
- **Pass dependencies in as parameters** (the model, config values, streams) instead of
  importing or creating them inside the function. This keeps functions testable with fakes
  (e.g. the AI SDK's `MockLanguageModelV4` from `ai/test`).
- **One responsibility per function and per file.** Name files after what they do, in
  kebab-case (`user-input.ts`, `test-cases.ts`).

## Comments

- Don't comment what the code already says. Clear names replace most comments.
- Add a comment only for logic that is complex or non-obvious: a tricky algorithm, a
  workaround, a constraint from an external API, or a decision a reader would otherwise
  question. Explain **why**, not what.
- No JSDoc on every function. Add it to an exported function only when its behavior isn't
  clear from its name and types (e.g. edge cases, what it returns on empty input).
- Keep comments true: update or delete them when the code changes.

## TypeScript practices

- Named exports only; no `export default`.
- Never use `any`. Use `unknown` for untrusted values and narrow them (zod for external data).
- Declare explicit return types on exported functions.
- Prefer `const`, immutable data, and pure functions (same input, same output, no side effects).
- Prefer early returns over nested `if`/`else`.
- No magic numbers or strings: give them a named `UPPER_SNAKE_CASE` constant.
- Naming: functions are verbs in camelCase (`generateTestCases`), constants are
  `UPPER_SNAKE_CASE`, types are `PascalCase`.
- Use `async`/`await`; never leave a promise un-awaited.
- Throw `Error` objects with a clear message. Catch errors at the entry point, where they're
  turned into a user-facing message and a non-zero exit code; don't swallow them elsewhere.

## LLM and agent practices

- Prompts (instructions) are exported string constants in the module that uses them, so they're
  easy to find, review and test.
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
- Import from `src/` only via the `#/` alias (`#/config.js`, defined in `package.json` `"imports"`). Relative imports (`./`, `../`) are rejected by ESLint.
- Use `import type` for type-only imports (`verbatimModuleSyntax` is on).
- Read env vars only through `src/config.ts`; never use `process.env` elsewhere.
  New variables go in the zod schema and `.env.example`: use the `add-env-var` skill.
- Import order is enforced by `import-x/order`: builtins, external, `#/` internal, then `import type`.
- Commits and PR titles follow Conventional Commits (`feat: ...`, `fix(scope): ...`).
- Tooling goes in `devDependencies`. Keep runtime dependencies minimal.
- Use `npm` (lockfile is `package-lock.json`). No `npx` inside npm scripts.

## Don't change without asking

- `tsconfig.json` strictness flags, `module`/`target`, or the `#/*` alias (`package.json` `"imports"` + `customConditions`).
- ESLint rules or presets — fix the code instead of disabling rules. No `eslint-disable`
  comments without a reason in the same comment.
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
