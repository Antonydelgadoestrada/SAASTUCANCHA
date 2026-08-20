import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Court } from '../court/court.entity';
import { ScheduleTemplate } from './schedule_template.entity';

@Entity('court_schedule_event')
export class CourtScheduleEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'courtId' })
  courtId: string;

  @ManyToOne(() => Court, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'courtId' })
  court: Court;

  @Column({ type: 'uuid', name: 'templateId', nullable: true })
  templateId: string | null;

  @ManyToOne(() => ScheduleTemplate, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'templateId' })
  template: ScheduleTemplate | null;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  /** weekly | monthly | custom */
  @Column({ name: 'recurrenceType' })
  recurrenceType: string;

  @Column({ type: 'jsonb', name: 'recurrenceConfig', default: () => "'{}'::jsonb" })
  recurrenceConfig: Record<string, unknown>;

  /** Cada rango: `start`, `until` (fin exclusivo HH:mm). Legacy: `end` en filas antiguas. */
  @Column({ type: 'jsonb', name: 'timeRanges', default: () => "'[]'::jsonb" })
  timeRanges: { start: string; until?: string; end?: string }[];

  @Column({ type: 'float', default: 0 })
  price: number;

  @Column({ name: 'isActive', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz' })
  updatedAt: Date;
}
