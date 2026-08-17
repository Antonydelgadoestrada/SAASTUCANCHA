import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return `Hello World! FRI ambiente ${process.env.NODE_ENV}`;
  }
}
