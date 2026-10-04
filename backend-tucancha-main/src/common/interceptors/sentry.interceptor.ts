import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { formatInTimeZone } from 'date-fns-tz'
function sanitizeSensitiveData(data: any): any {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeSensitiveData);

  const sensitiveKeys = new Set([
    'password',
    'newpassword',
    'oldpassword',
    'token',
    'refreshtoken',
    'accesstoken',
    'secret',
    'cvv',
    'cardnumber',
    'mpaccesstoken',
    'mprefreshtoken',
  ]);

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (sensitiveKeys.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeSensitiveData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'string' ? res : (res as any).message || message;
    } else if (exception instanceof Error) {
      message = exception.message;
    }
    Sentry.captureException(exception instanceof Error ? exception : new Error(message), {
      extra: {
        url: request.url,
        method: request.method,
        body: sanitizeSensitiveData(request.body),
        query: sanitizeSensitiveData(request.query),
        user: request.user ? { id: request.user.id, email: request.user.email, role: request.user.role } : undefined,
        rawException: exception, // incluir también el objeto original
      },
    });
    const timestamp = formatInTimeZone(new Date(), 'America/Lima', 'yyyy-MM-dd HH:mm:ssXXX')
    // Responder al cliente
    response.status(status).json({
      statusCode: status,
      // timestamp: new Date().toISOString(),
      timestamp,
      // path: request.url,
      message,
    });
  }
}
