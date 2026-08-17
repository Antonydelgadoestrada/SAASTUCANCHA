import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Club } from '../../club/club.entity';
import { MembershipPlan } from './membership_plan.entity';
import { MembershipPayment } from './membership_payment.entity';
import { MembershipStatus } from '../enums/membership-status.enum';

@Entity('club_memberships')
export class ClubMembership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  clubId: string;

  @ManyToOne(() => Club, (club) => (club as any).memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clubId' })
  club: Club;

  @Index()
  @Column()
  planId: string;

  @ManyToOne(() => MembershipPlan, (plan) => plan.memberships, { eager: true })
  @JoinColumn({ name: 'planId' })
  plan: MembershipPlan;

  @Index()
  @Column({
    type: 'enum',
    enum: MembershipStatus,
    default: MembershipStatus.PENDING,
  })
  status: MembershipStatus;

  @Column({ type: 'timestamp' })
  startDate: Date;

  @Index()
  @Column({ type: 'timestamp' })
  endDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  graceEndDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  nextBillingDate?: Date;

  @Column({ default: true })
  autoRenew: boolean;

  @Column({ default: false })
  cancelAtPeriodEnd: boolean;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt?: Date;

  @OneToMany(() => MembershipPayment, (payment) => payment.membership)
  payments: MembershipPayment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
