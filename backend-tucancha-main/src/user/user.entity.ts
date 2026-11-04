// src/user/user.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  OneToOne,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Booking } from '../booking/booking.entity';
import { Club } from '../club/club.entity';
import { Review } from '../review/review.entity';
import { UserRole } from './user-role.enum';
import { Payment } from '../payment/payment.entity';
import { Exclude } from 'class-transformer';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude()
  password: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @Column({ nullable: true })
  avatar?: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isVerified: boolean;

  // ⬇️ Nuevo campo para el refresh token
  @Column({ type: 'text', nullable: true })
  @Exclude()
  refreshToken?: string;

  @Column({ nullable: true })
  @Exclude()
  emailConfirmationToken?: string;

  @Column({ nullable: true })
  @Exclude()
  emailConfirmationExpires?: Date; // Para que expire en 10 min

  @Column({ nullable: true })
  googleId?: string; // Para login con Google

  // Permisos para roles secundarios (recepcionistas)
  @Column('text', { array: true, default: '{}' })
  permissions: string[];

  // Club asignado para usuarios secundarios (recepcionistas)
  @Column({ nullable: true })
  assignedClubId?: string;

  @ManyToOne(() => Club, (club) => club.users, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assignedClubId' })
  assignedClub?: Club;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date;

  // Relaciones
  @OneToMany(() => Booking, (booking) => booking.user)
  bookings: Booking[];

  // Relación con club para dueños (rol CLUB)
  @OneToOne(() => Club, (club) => club.owner)
  club?: Club;

  @OneToMany(() => Review, (review) => review.user)
  reviews: Review[];

  @OneToMany(() => Payment, (payment) => payment.user)
  payments: Payment[];
}
