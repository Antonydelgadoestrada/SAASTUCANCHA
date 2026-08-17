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
import { Venue } from '../venue/entities/venue.entity';

import * as dotenv from 'dotenv';
dotenv.config();

import { MembershipPlan } from '../membership/entities/membership_plan.entity';
import { ClubMembership } from '../membership/entities/club_membership.entity';
import { MembershipPayment } from '../membership/entities/membership_payment.entity';
import { ScheduleTemplate } from '../schedule/schedule_template.entity';
import { CourtScheduleAvailability } from '../schedule/court_schedule_availability.entity';
import { CourtScheduleEvent } from '../schedule/court_schedule_event.entity';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'aws-0-us-east-1.pooler.supabase.com',
  port: Number(process.env.DATABASE_PORT) || 5432,
  username: process.env.DATABASE_USERNAME || 'postgres.fartlyhtwqgklcvweetb',
  password: process.env.DATABASE_PASSWORD || 'Tucancha20206',
  database: process.env.DATABASE_DATABASE || 'postgres',
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: [
    User,
    Club,
    Court,
    Booking,
    Promotion,
    Review,
    Payment,
    Venue,
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
const venueRepo = AppDataSource.getRepository(Venue)


await AppDataSource.query(`
  TRUNCATE TABLE 
    "payment",
    "review",
    "promotion",
    "booking",
    "court",
    "club",
    "user",
    "venue"
  CASCADE
`);


  // Crear usuarios según users.md
  const adminUser = userRepo.create({
    name: 'Administrador General',
    email: 'brussitocomunica2017@gmail.com',
    password: await bcrypt.hash('admin123', 10),
    role: UserRole.ADMIN,
    isVerified: true,
    isActive: true,
  });

  const clubUser = userRepo.create({
    name: 'Propietario Club Elite',
    email: 'club@example.com',
    password: await bcrypt.hash('password123', 10),
    role: UserRole.CLUB,
    isVerified: true,
    isActive: true,
  });
  
  const normalUser = userRepo.create({
    name: 'Antony Demo',
    email: 'antonydgyt@gmail.com',
    password: await bcrypt.hash('Utepino=13', 10),
    role: UserRole.USER,
    isVerified: true,
    isActive: true,
  });

  await userRepo.save([adminUser, clubUser, normalUser]);

  // Crear planes de membresía por defecto
  const planRepo = AppDataSource.getRepository(MembershipPlan);
  const membershipRepo = AppDataSource.getRepository(ClubMembership);

  const planPro = planRepo.create({
    name: 'Plan Pro Anual',
    description: 'Acceso total a gestión de canchas, reservas y pagos automatizados',
    price: 120,
    currency: 'PEN',
    interval: 'ANNUAL' as any,
    graceDays: 7,
    maxCourts: 10,
    features: ['Gestión de horarios', 'Pasarela de pago', 'Soporte prioritario'],
    isActive: true,
  });
  await planRepo.save(planPro);

  // Crear club
  const club = clubRepo.create({
    owner: clubUser,
    name: 'Club Deportivo Elite',
    email: 'contacto@clubelite.com',
    phone: '987654321',
    address: 'Av. Principal 456',
    district: 'Lima',
    description: 'Club completo con canchas de fútbol, vóley y piscina.',
    logo: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018',
    images: ['https://images.unsplash.com/photo-1574629810360-7efbbe195018'],
    socialMedia: {
      facebook: 'https://facebook.com/clubelite',
      instagram: 'https://instagram.com/clubelite',
    },
    coordinates: {
      lat: -12.0464,
      lng: -77.0428,
    },
    services: ['cochera', 'wifi', 'piscina'],
    status: 'APPROVED',
    approvedAt: new Date(),
  });
  await clubRepo.save(club);

  // Asignar membresía activa al club
  const clubMembership = membershipRepo.create({
    club: club,
    plan: planPro,
    status: 'ACTIVE' as any,
    startDate: new Date(),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    graceEndDate: new Date(Date.now() + 372 * 24 * 60 * 60 * 1000),
    autoRenew: true,
  });
  await membershipRepo.save(clubMembership);

  const sedeCentral = venueRepo.create({
    name: 'Sede Central',
    phone: '123456789',
    email: 'sede@central.com',
    description: 'Sede principal con múltiples canchas.',
    image: 'https://images.unsplash.com/photo-1529900241943-41cbe7868ff1',
    capacity: '500',
    parkingSpots: '50',
    openingHours: '08:00 - 22:00',
    services: ['wifi', 'cafetería', 'estacionamiento'],
    accessibilityFeatures: 'Rampa, ascensor',
    nearbyTransport: 'Paradero Metropolitano Central',
    specialInstructions: 'Entrada por la Av. Principal',
    club: club,
    location: {
      address: "Av. Universitaria 123, Comas",
      coordinates: { lat: -11.935, lng: -77.054 },
    },
  });
  await venueRepo.save(sedeCentral); 

  // Crear canchas
  const court1 = courtRepo.create({
    name: 'Cancha de Fútbol 7',
    type: 'futbol_7',
    surface: 'sintético',
    description: 'Cancha sintética con iluminación y césped artificial.',
    priceDay: "35",
    priceNight: "45",
    promoDay: "30",
    promoNight: "40",
    images: ['https://images.unsplash.com/photo-1529900241943-41cbe7868ff1'],
    dimensions: {
      length: 40,
      width: 20,
      unit: 'meters',
    },
    isActive: true,
    venue: sedeCentral,
  });

  const court2 = courtRepo.create({
    name: 'Cancha de Vóley',
    type: 'vóley',
    surface: 'cemento',
    description: 'Piso antideslizante ideal para vóley recreativo.',
    images: ['https://images.unsplash.com/photo-1612872087720-bb876e2e67d1'],
    priceDay: "35",
    priceNight: "45",
    promoDay: "30",
    promoNight: "40",
    dimensions: {
      length: 18,
      width: 9,
      unit: 'meters',
    },
    isActive: true,
    venue: sedeCentral,
  });

  await courtRepo.save([court1, court2]);
  console.log('✅ Seed completado exitosamente en Supabase!');
  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('❌ Error en el seed:', err);
});
