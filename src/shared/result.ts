/**
 * The outcome of an operation that can fail in an expected way (not found, invalid input, an
 * upstream API rejecting a request). Callers must check `ok` before using `value`, so expected
 * failures can't be ignored the way an uncaught exception can. Unexpected bugs still throw.
 */
export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };

export type AppError = {
  /** Stable, machine-readable identifier, e.g. "JIRA_ISSUE_NOT_FOUND". */
  code: string;
  message: string;
  cause?: unknown;
};

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E = AppError>(error: E): Result<never, E> {
  return { ok: false, error };
}
