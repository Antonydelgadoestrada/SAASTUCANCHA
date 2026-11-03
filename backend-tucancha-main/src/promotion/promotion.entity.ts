import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Club } from '../club/club.entity';
import { Court } from '../court/court.entity';
import { PromotionType } from './promotion-type.enum';

export class NumericTransformer {
  to(data: number | null): number | null {
    return data;
  }
  from(data: string | null): number | null {
    return data !== null && data !== undefined ? parseFloat(data) : null;
  }
}

@Entity()
@Index('idx_promotion_club_active', ['clubId', 'isActive'])
@Index('idx_promotion_court_lookup', ['courtId', 'isActive'])
export class Promotion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Club, (club) => club.promotions, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'clubId' })
  club?: Club;

  @Column({ nullable: true })
  clubId?: string;

  @ManyToOne(() => Court, (court) => court.promotions, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'courtId' })
  court?: Court | null;

  @Column({ nullable: true })
  courtId?: string | null;

  @Column({ type: 'boolean', default: false })
  applyToAllCourts: boolean;

  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ type: 'enum', enum: PromotionType, default: PromotionType.HAPPY_HOUR })
  type: PromotionType;

  @Column({ type: 'varchar', length: 5, default: '00:00' })
  startTime: string;

  @Column({ type: 'varchar', length: 5, default: '23:59' })
  endTime: string;

  @Column('int', { array: true, default: '{1,2,3,4,5,6,0}' })
  daysOfWeek: number[];

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: new NumericTransformer(),
  })
  discountPercentage: number;

  @Column('jsonb', { nullable: true })
  discount?: {
    type: 'percentage' | 'fixed';
    value: number;
  };

  @Column('jsonb', { nullable: true })
  conditions?: {
    minBookings?: number;
    minAmount?: number;
    daysOfWeek?: string[];
    timeSlots?: string[];
    sports?: string[];
  };

  @Column({ type: 'date', nullable: true })
  startDate?: Date;

  @Column({ type: 'date', nullable: true })
  endDate?: Date;

  @Column({ nullable: true })
  maxUses?: number;

  @Column({ default: 0 })
  currentUses: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
