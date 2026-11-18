/**
 * The outcome of an operation that can fail in an expected way (not found, invalid input, an
 * upstream API rejecting a request). Callers must check `ok` before using `value`, so expected
 * failures can't be ignored the way an uncaught exception can. Unexpected bugs still throw.
 * Build values with `ok()` and `err()` from `src/shared/result.ts`.
 */
export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };

export type AppError = {
  /** Stable, machine-readable identifier, e.g. "JIRA_ISSUE_NOT_FOUND". */
  code: string;
  message: string;
  cause?: unknown;
};
