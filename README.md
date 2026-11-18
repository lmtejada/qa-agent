# qa-agent

CLI QA agent that turns user stories into test cases using Gemini.

You give it a user story, and the agent sends it to Gemini (through the
[Vercel AI SDK](https://ai-sdk.dev/)) and returns up to 10 test cases: positive, negative,
edge-case and security scenarios. It runs in two modes that share the same logic:

- **Terminal** (`npm start`): asks for a story, prints the test cases, and asks for the next
  one until you type `exit` or press Ctrl+D.
- **HTTP server** (`npm run serve`): keeps listening for requests from other apps and scripts.

Node runs the compiled output (`tsc` → `dist/`).

## Prerequisites

- [Node.js](https://nodejs.org/) 24 LTS (see [`.nvmrc`](.nvmrc); `nvm use` picks it up)
- npm 11+ (ships with Node 24)

## Setup

```sh
nvm use
npm ci
cp .env.example .env   # then set GOOGLE_GENERATIVE_AI_API_KEY
npm run build
npm start
```

Get a free API key at [Google AI Studio](https://aistudio.google.com/apikey).

## HTTP API

Start it with `npm run build && npm run serve`. By default it listens on
`http://127.0.0.1:3000` (set `PORT` and `HOST` in `.env`). It has no authentication, so keep
it on `127.0.0.1` unless you're on a trusted network.

```sh
curl -X POST http://127.0.0.1:3000/test-cases \
  -H 'content-type: application/json' \
  -d '{"userStory": "As a user, I want to reset my password by email"}'
```

| Endpoint           | Request                                     | Responses                                                                                                                                 |
| ------------------ | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /test-cases` | JSON `{"userStory": "..."}`, 1–10,000 chars | `200 {"testCases": "...", "usage": {"inputTokens", "outputTokens"}}`, `400` invalid body, `413` body over 100 KB, `502` model call failed |
| `GET /health`      | —                                           | `200 {"status": "ok"}`                                                                                                                    |

Ctrl+C (or `SIGTERM`) stops accepting new requests and lets running ones finish.

## Scripts

| Script                 | What it does                                                         |
| ---------------------- | -------------------------------------------------------------------- |
| `npm run dev`          | Runs `src/cli/index.ts` with tsx and restarts on changes             |
| `npm run build`        | Compiles `src/` to `dist/` with `tsc`                                |
| `npm start`            | Runs the compiled terminal app from `dist/` (run `build` first)      |
| `npm run dev:server`   | Runs `src/server/index.ts` with tsx and restarts on changes          |
| `npm run serve`        | Runs the compiled HTTP server from `dist/` (run `build` first)       |
| `npm test`             | Runs the tests (`src/**/*.test.ts`) with Node's test runner          |
| `npm run typecheck`    | Type-checks `src/` and the config files without emitting             |
| `npm run lint`         | Runs ESLint (type-aware)                                             |
| `npm run lint:fix`     | Runs ESLint and applies automatic fixes                              |
| `npm run format`       | Formats all files with Prettier                                      |
| `npm run format:check` | Checks formatting without writing                                    |
| `npm run check`        | Runs everything CI runs: format, lint, typecheck, test, build, audit |

## Environment variables

Every variable is listed and explained in [`.env.example`](.env.example), and validated at
startup by `loadConfig()` in [`src/shared/config.ts`](src/shared/config.ts).

## Folder structure

```text
.
├── .claude/
│   ├── hooks/               # lint-edited-file.sh: lints each file Claude edits
│   ├── rules/               # Path-scoped rules: typescript.md, testing.md, ai-engineering.md
│   ├── settings.json        # Registers the hook
│   └── skills/              # Project skills: add-env-var, prepare-pr, review-changes, write-adr
├── .github/
│   ├── ISSUE_TEMPLATE/      # Bug report and feature request forms
│   ├── workflows/           # ci, pr-title, codeql
│   ├── dependabot.yml
│   ├── pull_request_template.md
│   └── SECURITY.md
├── .husky/                  # pre-commit, commit-msg, pre-push hooks
├── docs/adr/                # Architecture decision records (start from `0. template.md`)
├── src/
│   ├── ai/                  # Everything that calls a model
│   │   ├── gemini-client.ts # createGeminiModel(): the Gemini model
│   │   ├── prompts/
│   │   │   └── test-generation.ts # Instructions + user-message builder
│   │   └── test-generator.ts # generateTestCases(story, model)
│   ├── cli/                 # Terminal interface
│   │   ├── index.ts         # Entry point: terminal loop
│   │   └── user-input.ts    # Reads the next multi-line user story
│   ├── server/              # HTTP interface
│   │   ├── http-handler.ts  # Routes, request validation, JSON responses
│   │   └── index.ts         # Entry point: HTTP server
│   └── shared/
│       ├── config.ts        # loadConfig(): loads and validates env vars (zod)
│       ├── errors.ts        # getErrorMessage()
│       └── result.ts        # Result<T>, ok(), err() for expected failures
├── .env.example             # Every env variable, documented
├── eslint.config.ts
├── tsconfig.json            # Type-checking (editor, ESLint, `typecheck`)
└── tsconfig.build.json      # Emit to dist/ (`build`)
```

## Conventions

- **ES modules** throughout (`"type": "module"`). Imports of project files use `.js`
  extensions (`#/shared/config.js` for `config.ts`), as Node requires for compiled ESM.
- **No relative imports:** import project files through the `#/` alias only. ESLint
  (`no-restricted-imports`) rejects `./` and `../` paths.
- **Path alias:** `#/*` maps to `src/*` (e.g. `import { loadConfig } from "#/shared/config.js"`), using
  Node's native [subpath imports](https://nodejs.org/api/packages.html#subpath-imports) in
  `package.json` — no build-time rewriting. A custom `template-source` condition points TypeScript,
  ESLint and tsx at `src/`; plain `node` resolves the same import to `dist/`. (`@/` isn't
  possible natively: Node requires subpath imports to start with `#`.)
- **No code in a file's body:** files export only functions or constant data, and all logic
  lives inside functions. The only exceptions are the entry points, `src/cli/index.ts` and `src/server/index.ts`,
  whose last line calls `main()`.
  Functions receive their dependencies (the model, config, streams) as parameters and return
  results instead of printing them. See `CLAUDE.md` for the full code rules.
- **Layered architecture:** interfaces (`cli/`, `server/`) → workflows → capabilities (`ai/`,
  `integrations/`, ...) → foundation (`validation/`, `shared/`). ESLint rejects imports against
  that direction, classes, top-level code, and oversized functions. `CLAUDE.md` describes the
  architecture, the client pattern, dependency injection, errors and testing rules, and
  ADR 0002 explains why.
- **Folders by capability:** `ai/`, `cli/`, `server/`, `shared/`, and later `integrations/`,
  `validation/`, `automation/`, `reporting/`. New folders are added with the feature that needs
  them. `CLAUDE.md` describes what goes where.
- **AI providers:** one `<provider>-client.ts` per provider in `src/ai/` (only Gemini for now).
  The rest of the code works with the AI SDK's `LanguageModel` type, so adding a provider
  doesn't change capability code.
- **Prompts** live in `src/ai/prompts/`, one file per capability.
- **Config:** read env vars only through `loadConfig()` from `src/shared/config.ts`. Add new variables with
  the `add-env-var` skill, which updates the zod schema and `.env.example`. `.env` is loaded with Node's built-in
  `process.loadEnvFile()` — no dotenv.

## Contributing

### Branch naming

Branch from `main` using `<type>/<short-description>`, with the same types as commits:
`feat/add-health-endpoint`, `fix/config-port-parsing`, `docs/update-readme`, `chore/bump-deps`.

### Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org/), enforced by
commitlint in the `commit-msg` hook:

```text
<type>(<optional scope>): <subject>

feat(config): add PORT variable
fix: handle missing .env file
docs: explain path alias
```

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`.
Add `!` after the type (`feat!:`) or a `BREAKING CHANGE:` footer for breaking changes.

PRs are merged with a **merge commit**, so every commit in your branch lands on `main` as-is.
Keep them meaningful: squash fixups like "fix typo" or "address review" locally before opening
the PR. The PR title appears in the merge commit and is validated the same way.

### Before opening a PR

Run `npm run check`. It runs exactly what CI runs, and `npm run format` and `npm run lint:fix`
fix most issues automatically. The Git hooks also check your work along the way:

| Hook         | Runs                              |
| ------------ | --------------------------------- |
| `pre-commit` | ESLint + Prettier on staged files |
| `commit-msg` | commitlint                        |
| `pre-push`   | `npm run typecheck` + `npm test`  |

When you work with Claude Code, a project hook also lints every file it edits under `src/` and
sends the errors back, so rule violations are fixed during the task.

Fill in the PR template, keep PRs focused on one change, and make sure CI is green. For
significant architectural changes, add an ADR in `docs/adr/` (the `write-adr` skill writes one
from the discussion).

## License

[ISC](LICENSE)
