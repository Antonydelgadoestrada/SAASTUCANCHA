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

@Entity('loyalty_config')
export class LoyaltyConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', unique: true })
  clubId: string;

  @ManyToOne(() => Club, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clubId' })
  club: Club;

  @Column({ type: 'boolean', default: false })
  isActive: boolean;

  @Column({ type: 'varchar', length: 10, default: 'A' })
  mode: 'A' | 'B'; // 'A': Horario (Día/Noche) | 'B': Cada X reservas

  @Column({ type: 'int', default: 0 })
  dayPoints: number;

  @Column({ type: 'int', default: 0 })
  nightPoints: number;

  @Column({ type: 'varchar', length: 5, default: '18:00' })
  nightStartsAt: string;

  @Column({ type: 'int', default: 1 })
  bonusEveryX: number;

  @Column({ type: 'int', default: 0 })
  bonusPoints: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
