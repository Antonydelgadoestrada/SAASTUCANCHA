import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
  } from 'typeorm';
  import { User } from '../user/user.entity';
  import { Booking } from '../booking/booking.entity';
  import { Court } from '../court/court.entity';
  import { Club } from '../club/club.entity';
  
  @Entity()
  export class Review {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @ManyToOne(() => User, (user) => user.reviews, { onDelete: 'CASCADE' })
    user: User;
  
    @ManyToOne(() => Booking, (booking) => booking.review, { nullable: true, onDelete: 'SET NULL' })
    booking?: Booking;
  
    @ManyToOne(() => Court, (court) => court.reviews, { nullable: true, onDelete: 'SET NULL' })
    court?: Court;
  
    @ManyToOne(() => Club, (club) => club.reviews, { nullable: true, onDelete: 'SET NULL' })
    club?: Club;
  
    @Column({ type: 'int' })
    rating: number;
  
    @Column({ nullable: true })
    title?: string;
  
    @Column()
    comment: string;
  
    @Column('text', { array: true, nullable: true })
    images?: string[];
  
    @Column({ default: false })
    isVerified: boolean;
  
    @Column({ default: true })
    isVisible: boolean;
  
    @CreateDateColumn()
    createdAt: Date;
  
    @UpdateDateColumn()
    updatedAt: Date;
  }
  