import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { BillingInterval } from '../enums/billing-interval.enum';
import { ClubMembership } from './club_membership.entity';

@Entity('membership_plans')
export class MembershipPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ default: 'PEN' })
  currency: string;

  @Column({
    type: 'enum',
    enum: BillingInterval,
    default: BillingInterval.MONTHLY,
  })
  interval: BillingInterval;

  @Column({ type: 'int', default: 3 })
  graceDays: number;

  @Column({ type: 'jsonb', default: [] })
  features: string[];

  @Column({ type: 'int', nullable: true })
  maxCourts?: number;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => ClubMembership, (membership) => membership.plan)
  memberships: ClubMembership[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
