import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as Sentry from '@sentry/node';
import { AllExceptionsFilter } from './common/interceptors/sentry.interceptor';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  try {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 1.0,
    });

    const app = await NestFactory.create(AppModule);

    const corsOrigins = process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
      : [
          'https://tucancha.com.pe',
          'https://www.tucancha.com.pe',
          process.env.WEB_SERVICES_URL,
        ].filter(Boolean);

    app.enableCors({
      origin: corsOrigins,
      methods: 'GET,POST,PUT,DELETE,OPTIONS,PATCH',
      credentials: true,
    });

    app.useGlobalFilters(new AllExceptionsFilter());

    const port = Number(process.env.PORT) || 3001;
    await app.listen(port);
    console.log(`API listening on port ${port}`);
  } catch (error) {
    console.error('Failed to start API:', error);
    process.exit(1);
  }
}
bootstrap();
