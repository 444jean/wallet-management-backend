import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Request, Response } from 'express';
import { redactString } from './redact.js';
import { safeLogger } from './safe-logger.js';

/** Errors from Express middleware (body-parser) carry their HTTP status. */
function httpErrorStatus(e: unknown): number | null {
  if (typeof e !== 'object' || e === null) return null;
  const status = (e as { status?: unknown; statusCode?: unknown }).status ??
    (e as { statusCode?: unknown }).statusCode;
  return typeof status === 'number' && status >= 400 && status < 600
    ? status
    : null;
}

const CLIENT_ERROR_MESSAGES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'La petición no es válida.',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'La petición es demasiado grande.',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'Tipo de contenido no soportado.',
};

/**
 * Last line of defense (T03): no internal detail (stack, SQL, paths) ever
 * reaches the client. 5xx answer a generic message and the detail goes to
 * the (redacted) log; Nest HttpExceptions keep their normal 4xx body.
 */
@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    if (exception instanceof HttpException && exception.getStatus() < 500) {
      return super.catch(exception, host);
    }

    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : (httpErrorStatus(exception) ?? HttpStatus.INTERNAL_SERVER_ERROR);

    if (status < 500) {
      // body-parser and friends: invalid JSON, body too large...
      res.status(status).json({
        statusCode: status,
        message: CLIENT_ERROR_MESSAGES[status] ?? 'La petición no es válida.',
      });
      return;
    }

    safeLogger.error(
      `${req.method} ${redactString(req.originalUrl ?? req.url)} -> ${status}`,
      exception instanceof Error ? exception.stack : String(exception),
      'ExceptionsFilter',
    );
    if (res.headersSent) return;
    res.status(status).json({
      statusCode: status,
      message: 'Error interno del servidor.',
    });
  }
}
