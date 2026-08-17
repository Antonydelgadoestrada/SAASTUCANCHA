import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
  } from 'typeorm';
  import { Club } from '../club/club.entity';
  import { Court } from '../court/court.entity';
  import { PromotionType } from './promotion-type.enum';
  
  @Entity()
  export class Promotion {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @ManyToOne(() => Club, (club) => club.promotions, { nullable: true })
    club?: Club;
  
    @ManyToOne(() => Court, (court) => court.promotions, { nullable: true })
    court?: Court;
  
    @Column()
    name: string;
  
    @Column()
    description: string;
  
    @Column({ type: 'enum', enum: PromotionType })
    type: PromotionType;
  
    @Column('jsonb')
    discount: {
      type: 'percentage' | 'fixed';
      value: number;
    };
  
    @Column('jsonb')
    conditions: {
      minBookings?: number;
      minAmount?: number;
      daysOfWeek?: string[];
      timeSlots?: string[];
      sports?: string[];
    };
  
    @Column({ type: 'date' })
    startDate: Date;
  
    @Column({ type: 'date' })
    endDate: Date;
  
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
  