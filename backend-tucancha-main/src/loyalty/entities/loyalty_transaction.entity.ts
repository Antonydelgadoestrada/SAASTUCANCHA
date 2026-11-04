import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Club } from '../../club/club.entity';
import { User } from '../../user/user.entity';
import { Booking } from '../../booking/booking.entity';
import { LoyaltyRedemption } from './loyalty_redemption.entity';

export enum LoyaltyTransactionType {
  EARN_DAY = 'EARN_DAY',
  EARN_NIGHT = 'EARN_NIGHT',
  EARN_COUNT = 'EARN_COUNT',
  EARN_BONUS = 'EARN_BONUS',
  REDEEM = 'REDEEM',
  REFUND = 'REFUND',
  REVERSAL = 'REVERSAL',
}

@Entity('loyalty_transaction')
@Index('uq_loyalty_tx_booking_type', ['bookingId', 'type'], {
  unique: true,
  where: '"bookingId" IS NOT NULL',
})
@Index(['clubId', 'userId', 'createdAt'])
export class LoyaltyTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  clubId: string;

  @ManyToOne(() => Club, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clubId' })
  club: Club;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 30 })
  type: LoyaltyTransactionType;

  @Column({ type: 'int' })
  points: number; // Positivo para EARN_*, negativo para REDEEM/REVERSAL, 0 para EARN_COUNT

  @Index()
  @Column({ type: 'uuid', nullable: true })
  bookingId?: string | null;

  @ManyToOne(() => Booking, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'bookingId' })
  booking?: Booking | null;

  @Column({ type: 'uuid', nullable: true })
  redemptionId?: string | null;

  @ManyToOne(() => LoyaltyRedemption, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'redemptionId' })
  redemption?: LoyaltyRedemption | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
