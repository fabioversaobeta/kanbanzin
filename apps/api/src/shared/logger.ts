/** Minimal logging port so that application code does not depend on a concrete logger. */
export interface Logger {
  info(context: object, message?: string): void;
  warn(context: object, message?: string): void;
  error(context: object, message?: string): void;
}

export const noopLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};
