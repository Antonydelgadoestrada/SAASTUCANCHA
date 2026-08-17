import { DataSource } from 'typeorm';

import { User } from '../user/user.entity';
import { Club } from '../club/club.entity';
import { Court } from '../court/court.entity';
import { Booking } from '../booking/booking.entity';
import { Promotion } from '../promotion/promotion.entity';
import { Review } from '../review/review.entity';
import { Payment } from '../payment/payment.entity';
// Aquí agrega nuevas entidades a medida que las crees

export const databaseProviders = [
  {
    provide: 'DATA_SOURCE',
    useFactory: async () => {
      const dataSource = new DataSource({
        type: 'postgres',
        host: 'localhost',
        port: 5432,
        username: 'admin',
        password: 'admin123',
        database: 'db_canchas',
        entities: [
          Booking,
          Club,
          Court,
          Payment,
          Promotion,
          Review,
          User,
          // agrega aquí más entidades
        ],
        synchronize: false, // ⚠️ Solo en desarrollo
      });

      return dataSource.initialize();
    },
  },
];
