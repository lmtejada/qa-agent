---
paths:
  - "src/**/*.test.ts"
---

# Testing standards

Applies when writing or changing tests. The obligation to test (new behavior, bug fixes) is in
`CLAUDE.md` because it applies to every code change.

## Tools

- Unit tests use `node:test` and `node:assert/strict`, in `<file>.test.ts` next to the code
  (ADR 0002). Don't add another test runner without an ADR.
- HTTP endpoints are tested through `buildServer(deps)` and Fastify's `app.inject()`, with no
  real port.
- Playwright belongs to `src/automation/` (running generated tests against applications under
  test). It isn't used for this project's own unit tests.

## Writing tests

- Follow Arrange, Act, Assert, with one behavior per test and a name that states it
  (`returns INVALID_STORY when the story is empty`).
- Test behavior through public functions, not implementation details (private helpers, call
  order, internal state).
- Cover positive, negative and boundary cases, and each failure condition (every `Result` error
  code a function can return).
- Use deterministic test data: fixed inputs, no unseeded randomness, and no real clock. Pass time
  in as a dependency or use `mock.timers` from `node:test`.
- No arbitrary sleeps. Await the operation or the condition instead.
- Keep tests independent: each test builds its own data and fakes. Don't share mutable state
  between tests or depend on test order.
- Fake only real boundaries, passed in as dependencies: `MockLanguageModelV4` from `ai/test` for
  models, a fake `fetch` or a fake client object for integrations. Test pure logic directly.
- Unit tests never call real external services or real models.
- A client's tests cover request building, response validation and error mapping, against a
  fake `fetch`.
- A regression test reproduces the defect: it fails without the fix and passes with it.
