import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm'
import { ScheduleTemplate } from './schedule_template.entity'
import { Court } from '../court/court.entity'

@Entity('court_schedule_availability')
@Index('idx_unique_court_date_time', ['courtId', 'date', 'time'], { unique: true })
@Index('idx_availability_court_date', ['courtId', 'date'])
export class CourtScheduleAvailability {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => Court, (court) => court.availabilities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'courtId' })
  court: Court

  @Column()
  courtId: string

  @Column({ type: 'date' })
  date: string

  @Column()
  time: string // "08:00"

  @Column({ type: 'enum', enum: ['available', 'blocked', 'occupied', 'on-hold', 'paid'] })
  status: 'available' | 'blocked' | 'occupied' | 'on-hold' | 'paid'

  @ManyToOne(() => ScheduleTemplate, (template) => template.availabilities, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'templateId' })
  template: ScheduleTemplate

  @Column({ nullable: true })
  templateId: string

  @CreateDateColumn()
  createdAt: Date
}
