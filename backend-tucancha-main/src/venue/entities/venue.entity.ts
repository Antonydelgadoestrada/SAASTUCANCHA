import { Club } from '../../club/club.entity';
import { Court } from '../../court/court.entity';
import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Venue {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'jsonb', nullable: true })
  location: {
    address: string
    coordinates: { lat: number; lng: number }
  }
  
  @Column()
  phone: string;
  
  @Column({ nullable: true })
  addressReference: string;

  @Column()
  email: string;

  @Column()
  description: string;

  @Column({ nullable: true })
  image?: string;

  @Column()
  capacity: string;

  @Column({ nullable: true })
  parkingSpots?: string;

  @Column()
  openingHours: string;

  @Column('text', { array: true })
  services: string[];

  @Column({ nullable: true })
  accessibilityFeatures?: string;

  @Column({ nullable: true })
  nearbyTransport?: string;

  @Column({ nullable: true })
  specialInstructions?: string;

  @ManyToOne(() => Club, (club) => club.venues, { onDelete: 'CASCADE' })
  club: Club;

  @OneToMany(() => Court, (court) => court.venue)
  courts: Court[];
}
