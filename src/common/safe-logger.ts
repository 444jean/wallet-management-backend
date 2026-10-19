import { ConsoleLogger } from '@nestjs/common';
import { redact } from './redact.js';

/**
 * Nest logger that never prints passwords, tokens, cookies or authorization
 * headers (T03). Used by the app (main.ts) and by Better Auth (auth.ts).
 */
export class SafeLogger extends ConsoleLogger {
  log(message: unknown, ...params: unknown[]) {
    super.log(redact(message), ...params.map((p) => redact(p)));
  }

  error(message: unknown, ...params: unknown[]) {
    super.error(redact(message), ...params.map((p) => redact(p)));
  }

  warn(message: unknown, ...params: unknown[]) {
    super.warn(redact(message), ...params.map((p) => redact(p)));
  }

  debug(message: unknown, ...params: unknown[]) {
    super.debug(redact(message), ...params.map((p) => redact(p)));
  }

  verbose(message: unknown, ...params: unknown[]) {
    super.verbose(redact(message), ...params.map((p) => redact(p)));
  }
}

export const safeLogger = new SafeLogger();
