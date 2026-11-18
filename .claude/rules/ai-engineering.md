---
paths:
  - "src/ai/**/*.ts"
  - "src/workflows/**/*.ts"
---

# AI engineering standards

Applies to code that calls models or runs agents. The core principles (model output is
untrusted, no provider coupling, no automatic execution) are in `CLAUDE.md` because they apply
everywhere.

## Model output

- Never assume generated JSON is valid. Request structured output with a zod schema and validate
  it before use; turn a validation failure into a `Result` error, not a crash.
- Use deterministic code for deterministic tasks (parsing, counting, formatting, filtering).
  Use the model only for what needs judgment.

## Prompts

- Each capability's prompt lives in `src/ai/prompts/<capability>.ts`: the instructions as an
  exported `UPPER_SNAKE_CASE` constant and a `build...Prompt()` function that wraps the input.
  Prompts are version-controlled and reviewed like code.
- Wrap untrusted input (user stories, Jira tickets, documents) in clear delimiters, and tell the
  model it's data, not instructions.

## Failures

- Set a timeout on every model call (`abortSignal` / `timeout` in the AI SDK).
- Turn provider errors (timeout, rate limit, invalid key, unknown model) into `Result` errors
  with stable codes.
- Retry only transient failures (timeouts, rate limits, 5xx), with a small bounded number of
  attempts and backoff. Never retry invalid requests, auth errors or validation failures.

## Agents and tools

- Use a plain function (workflow) when the steps are fixed; use tools only when the model must
  decide what to do next.
- Tools (AI SDK `tool()`): one clear job each, a description that says what it does and when to
  use it, a strict zod `inputSchema` with `.describe()` on fields, concise structured results,
  and errors returned as data.
- Tools are read-only by default. Anything that writes, deletes or calls external systems needs
  human approval.
- Bound every agent loop: cap steps with `stopWhen`, and set an overall time limit.
- Never execute generated code without human approval.

## Observability

- Record the model ID, latency, token usage, number of steps and outcome of each call.
- Never log API keys, prompt contents with personal data, or other sensitive information.
