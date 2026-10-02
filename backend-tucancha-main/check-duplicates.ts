import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { DataSource } from 'typeorm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);
  
  const query = `
    SELECT "courtId", date, "startTime", COUNT(*) as count
    FROM booking
    WHERE status != 'cancelled'
    GROUP BY "courtId", date, "startTime"
    HAVING COUNT(*) > 1;
  `;
  
  const results = await dataSource.query(query);
  console.log('--- DUPLICATES FOUND ---');
  console.log(JSON.stringify(results, null, 2));
  
  await app.close();
}
bootstrap();
