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
import { Club } from '../../club/club.entity';
import { LoyaltyRewardType } from '../enums/loyalty-reward-type.enum';

export class NumericTransformer {
  to(data: number | null): number | null {
    return data;
  }
  from(data: string | null): number | null {
    return data != null ? parseFloat(data) : null;
  }
}

@Entity('loyalty_reward')
@Index(['clubId', 'isActive'])
export class LoyaltyReward {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  clubId: string;

  @ManyToOne(() => Club, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clubId' })
  club: Club;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'int' })
  pointsCost: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({
    name: 'reward_type',
    type: 'varchar',
    length: 30,
    default: LoyaltyRewardType.TEXT_ONLY,
  })
  rewardType: LoyaltyRewardType;

  @Column({
    name: 'discount_value',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: new NumericTransformer(),
  })
  discountValue?: number | null;

  @Column({
    name: 'max_discount_amount',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: new NumericTransformer(),
  })
  maxDiscountAmount?: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
