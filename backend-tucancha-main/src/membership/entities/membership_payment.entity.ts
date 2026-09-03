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
import { ClubMembership } from './club_membership.entity';
import { MembershipPlan } from './membership_plan.entity';
import { MembershipPaymentStatus } from '../enums/membership-payment-status.enum';

@Entity('membership_payments')
export class MembershipPayment {
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
  membershipId?: string;

  @ManyToOne(() => ClubMembership, (membership) => membership.payments, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'membershipId' })
  membership?: ClubMembership;

  @Index()
  @Column()
  planId: string;

  @ManyToOne(() => MembershipPlan)
  @JoinColumn({ name: 'planId' })
  plan: MembershipPlan;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ default: 'PEN' })
  currency: string;

  @Index()
  @Column({
    type: 'enum',
    enum: MembershipPaymentStatus,
    default: MembershipPaymentStatus.PENDING,
  })
  status: MembershipPaymentStatus;

  @Index({ unique: true })
  @Column({ nullable: true })
  mpPaymentId?: string;

  @Index()
  @Column({ nullable: true })
  mpPreferenceId?: string;

  @Column({ nullable: true })
  mpMerchantOrderId?: string;

  @Column({ nullable: true })
  paymentMethod?: string;

  @Column({ nullable: true })
  paymentType?: string;

  @Column({ type: 'jsonb', nullable: true })
  gatewayResponse?: any;

  @Column({ type: 'timestamp', nullable: true })
  paidAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
