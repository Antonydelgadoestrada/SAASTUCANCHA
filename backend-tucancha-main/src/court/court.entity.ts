import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Booking } from '../booking/booking.entity';
import { Review } from '../review/review.entity';
import { Promotion } from '../promotion/promotion.entity';
import { Club } from '../club/club.entity';
import { CourtScheduleAvailability } from '../schedule/court_schedule_availability.entity';

@Entity()
export class Court {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  
  @Column()
  name: string;

  @Column({ nullable: true })
  type: string; // fútbol, tenis, etc.

  @Column()
  surface: string;

  @Column()
  priceDay : string;

  @Column()
  priceNight : string;

  @Column({ nullable: true })
  promoDay : string;

  @Column({ nullable: true })
  promoNight : string;

  @Column({ type: 'varchar', default: '1' }) // 1 hora como string
  minimumBookingTime: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', array: true, default: [] })
  images: string[];

  @Column('json', { nullable: true })
  dimensions?: {
    length: number;
    width: number;
    unit: 'meters' | 'feet';
  };

  @Column({ type: 'uuid', nullable: true })
  schedule_template_id?: string | null;
  @OneToMany(() => CourtScheduleAvailability, (a) => a.court)
  availabilities: CourtScheduleAvailability[]

  @ManyToOne(() => Club, (club) => club.courts, { onDelete: 'CASCADE' })
  club: Club
  @OneToMany(() => Promotion, (promotion) => promotion.court)
  promotions: Promotion[];

  @OneToMany(() => Booking, (booking) => booking.court)
  bookings: Booking[];

  @OneToMany(() => Review, (review) => review.court)
  reviews: Review[];

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export type CourtUpdateDto = {
  name: string
  type: string         // Ej: "fútbol"
  surface: string      // Ej: "sintético"
  priceDay: string
  priceNight: string
  promoDay?: string | null  // Opcional o null si no se envía
  promoNight?: string | null // Opcional o null si no se envía
  description: string
  existingImages?: string[]  // URLs de imágenes existentes

}
