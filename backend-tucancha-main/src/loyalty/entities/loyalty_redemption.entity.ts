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
import { LoyaltyReward, NumericTransformer } from './loyalty_reward.entity';
import { LoyaltyRewardType } from '../enums/loyalty-reward-type.enum';

export enum LoyaltyRedemptionStatus {
  PENDING = 'PENDING',
  DELIVERED = 'DELIVERED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  APPLIED = 'APPLIED',
}

@Entity('loyalty_redemption')
@Index(['clubId', 'status'])
@Index('uq_loyalty_redemption_booking', ['bookingId'], {
  unique: true,
  where: '"booking_id" IS NOT NULL',
})
export class LoyaltyRedemption {
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

  @Column({ type: 'uuid', nullable: true })
  rewardId?: string | null;

  @ManyToOne(() => LoyaltyReward, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'rewardId' })
  reward?: LoyaltyReward | null;

  @Column({ type: 'varchar', length: 255 })
  rewardNameSnapshot: string;

  @Column({ type: 'int' })
  rewardCostSnapshot: number;

  @Column({
    name: 'reward_type_snapshot',
    type: 'varchar',
    length: 30,
    default: LoyaltyRewardType.TEXT_ONLY,
  })
  rewardTypeSnapshot: LoyaltyRewardType;

  @Column({
    name: 'discount_value_snapshot',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: new NumericTransformer(),
  })
  discountValueSnapshot?: number | null;

  @Column({
    name: 'max_discount_snapshot',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: new NumericTransformer(),
  })
  maxDiscountSnapshot?: number | null;

  @Column({ name: 'booking_id', type: 'uuid', nullable: true })
  bookingId?: string | null;

  @ManyToOne(() => Booking, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'booking_id' })
  booking?: Booking | null;

  @Column({
    name: 'applied_discount_amount',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: new NumericTransformer(),
  })
  appliedDiscountAmount?: number | null;

  @Column({ name: 'applied_at', type: 'timestamptz', nullable: true })
  appliedAt?: Date | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: LoyaltyRedemptionStatus.PENDING,
  })
  status: LoyaltyRedemptionStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  rejectReason?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  requestedAt: Date;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt?: Date | null;

  @Column({ type: 'uuid', nullable: true })
  resolvedByUserId?: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'resolvedByUserId' })
  resolvedByUser?: User | null;
}
