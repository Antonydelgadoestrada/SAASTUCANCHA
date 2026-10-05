// src/seeds/seed.ts
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User } from '../user/user.entity';
import { Club } from '../club/club.entity';
import { Court } from '../court/court.entity';
import { Booking } from '../booking/booking.entity';
import { Promotion } from '../promotion/promotion.entity';
import { Review } from '../review/review.entity';
import { UserRole } from '../user/user-role.enum';
import { BookingStatus } from '../booking/booking-status.enum';
import { PromotionType } from '../promotion/promotion-type.enum';
import { Payment } from '../payment/payment.entity';
import { PaymentMethod } from '../payment/payment-method.enum';
import { PaymentStatus } from '../payment/payment-status.enum';

import * as dotenv from 'dotenv';
dotenv.config();

import { BillingInterval } from '../membership/enums/billing-interval.enum';
import { MembershipPlan } from '../membership/entities/membership_plan.entity';
import { ClubMembership } from '../membership/entities/club_membership.entity';
import { MembershipPayment } from '../membership/entities/membership_payment.entity';
import { ScheduleTemplate } from '../schedule/schedule_template.entity';
import { CourtScheduleAvailability } from '../schedule/court_schedule_availability.entity';
import { CourtScheduleEvent } from '../schedule/court_schedule_event.entity';

const dbUrl = process.env.DATABASE_URL ? process.env.DATABASE_URL.split('?')[0] : undefined;

const AppDataSource = new DataSource({
  type: 'postgres',
  ...(dbUrl ? { url: dbUrl } : {
    host: process.env.DATABASE_HOST || 'aws-0-us-east-1.pooler.supabase.com',
    port: Number(process.env.DATABASE_PORT) || 5432,
    username: process.env.DATABASE_USERNAME || 'postgres.fartlyhtwqgklcvweetb',
    password: process.env.DATABASE_PASSWORD || 'Tucancha20206',
    database: process.env.DATABASE_DATABASE || 'postgres',
  }),
  ssl: { rejectUnauthorized: false }, // DO requiere ssl
  extra: { ssl: { rejectUnauthorized: false } },
  entities: [
    User,
    Club,
    Court,
    Booking,
    Promotion,
    Review,
    Payment,

    MembershipPlan,
    ClubMembership,
    MembershipPayment,
    ScheduleTemplate,
    CourtScheduleAvailability,
    CourtScheduleEvent,
  ],
  synchronize: true,
});

async function seed() {
  await AppDataSource.initialize();

  const userRepo = AppDataSource.getRepository(User);
  const clubRepo = AppDataSource.getRepository(Club);
  const courtRepo = AppDataSource.getRepository(Court);
  const bookingRepo = AppDataSource.getRepository(Booking);
  const promotionRepo = AppDataSource.getRepository(Promotion);
  const reviewRepo = AppDataSource.getRepository(Review);
  const paymentRepo = AppDataSource.getRepository(Payment);
// ...


await AppDataSource.query(`
  TRUNCATE TABLE 
    "payment",
    "review",
    "promotion",
    "booking",
    "court",
    "club",
    "user"
  CASCADE
`);


  // Crear usuario administrador
  const adminUser = userRepo.create({
    name: 'Administrador TuCancha',
    email: 'tucancha100@gmail.com', // TIENE que ser minúscula para que el login lo encuentre
    password: await bcrypt.hash('admin123', 10),
    role: UserRole.ADMIN,
    isVerified: true,
    isActive: true,
  });

  await userRepo.save([adminUser]);

  // Crear planes de membresía por defecto (necesario para que los nuevos dueños puedan suscribirse)
  const planRepo = AppDataSource.getRepository(MembershipPlan);

  const planPro = planRepo.create({
    name: 'Plan Pro Mensual',
    description: 'Acceso total a gestión de canchas, reservas y pagos automatizados',
    price: 120,
    currency: 'PEN',
    interval: BillingInterval.MONTHLY,
    graceDays: 7,
    maxCourts: 6,
    features: ['Gestión de horarios', 'Pasarela de pago', 'Soporte prioritario'],
    isActive: true,
  });
  await planRepo.save(planPro);

  console.log('✅ Seed completado: Tablas creadas, Administrador (Tucancha100@gmail.com) y Plan Pro generados.');
  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('❌ Error en el seed:', err);
});
