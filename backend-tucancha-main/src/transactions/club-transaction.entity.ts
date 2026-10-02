import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Club } from '../club/club.entity';
import { Booking } from '../booking/booking.entity';
import { MembershipPayment } from '../membership/entities/membership_payment.entity';
import { User } from '../user/user.entity';
import { PaymentMethod } from '../payment/payment-method.enum';

export enum TransactionDirection {
  IN = 'IN',
  OUT = 'OUT',
}

export enum TransactionCategory {
  RESERVATION_FULL = 'RESERVATION_FULL',
  RESERVATION_ADVANCE = 'RESERVATION_ADVANCE',
  RESERVATION_BALANCE = 'RESERVATION_BALANCE',
  MEMBERSHIP_PAYMENT = 'MEMBERSHIP_PAYMENT',
  REFUND = 'REFUND',
  ADJUSTMENT = 'ADJUSTMENT',
  OTHER = 'OTHER',
}

export enum TransactionOrigin {
  MERCADOPAGO = 'MERCADOPAGO',
  VOUCHER = 'VOUCHER',
  MANUAL = 'MANUAL',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REFUNDED = 'REFUNDED',
}

@Entity('club_transactions')
@Index(['clubId', 'occurredAt'])
@Index(['sourceType', 'sourceId'], { unique: true })
export class ClubTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  clubId: string;

  @ManyToOne(() => Club, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clubId' })
  club: Club;

  @Index()
  @Column({ nullable: true })
  reservationId?: string;

  @ManyToOne(() => Booking, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reservationId' })
  reservation?: Booking;

  @Column({ nullable: true })
  membershipPaymentId?: string;

  @ManyToOne(() => MembershipPayment, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'membershipPaymentId' })
  membershipPayment?: MembershipPayment;

  @Column({ type: 'timestamptz', nullable: true })
  occurredAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  submittedAt?: Date;

  @Column({ type: 'enum', enum: TransactionDirection })
  direction: TransactionDirection;

  @Column({ type: 'enum', enum: TransactionCategory })
  category: TransactionCategory;

  @Column({ type: 'enum', enum: TransactionOrigin })
  origin: TransactionOrigin;

  @Column({ nullable: true })
  registeredByUserId?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'registeredByUserId' })
  registeredByUser?: User;

  @Column({ nullable: true })
  reviewedByUserId?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewedByUserId' })
  reviewedByUser?: User;

  @Column({ nullable: true })
  voucherRef?: string;

  @Column({ nullable: true })
  paymentMethod?: string;

  @Column({ nullable: true })
  channel?: string;

  @Column({ type: 'float', default: 0 })
  grossAmount: number;

  @Column({ type: 'float', default: 0 })
  feeAmount: number;

  @Column({ type: 'float', default: 0 })
  feePercent: number;

  @Column({ type: 'float', default: 0 })
  netAmount: number;

  @Column({ default: 'PEN' })
  currency: string;

  @Column({ type: 'float', nullable: true })
  reservationTotal?: number;

  @Column({ type: 'float', nullable: true })
  paidAccumulated?: number;

  @Column({ type: 'float', nullable: true })
  pendingAfter?: number;

  @Column({ type: 'enum', enum: TransactionStatus })
  status: TransactionStatus;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column()
  sourceType: string;

  @Column()
  sourceId: string;

  @Column({ nullable: true })
  externalId?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
