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
import { LoyaltyReward } from './loyalty_reward.entity';

export enum LoyaltyRedemptionStatus {
  PENDING = 'PENDING',
  DELIVERED = 'DELIVERED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

@Entity('loyalty_redemption')
@Index(['clubId', 'status'])
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
