import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne } from 'typeorm'
import { CourtScheduleAvailability } from './court_schedule_availability.entity'
import { Club } from '../club/club.entity'

@Entity('schedule_templates')
export class ScheduleTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  name: string

  @Column({ nullable: true })
  description: string

  @Column({ nullable: true })
  venueId: number // null si aplica a todas las sedes

  @Column("text", { array: true })
  days: string[] // ["monday", "tuesday", "friday"]

  @Column("jsonb")
  slots: {
    time: string // "08:00"
    status: 'available' | 'blocked'
  }[]

  @ManyToOne(() => Club, (club) => club.scheduleTemplates, { eager: false })
  club: Club

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @OneToMany(() => CourtScheduleAvailability, (a) => a.template)
  availabilities: CourtScheduleAvailability[]
}
