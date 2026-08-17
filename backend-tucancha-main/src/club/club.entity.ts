import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToMany,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
  } from 'typeorm';
import { User } from '../user/user.entity';
import { Booking } from '../booking/booking.entity';
import { Promotion } from '../promotion/promotion.entity';
import { Review } from '../review/review.entity';
import { Venue } from '../venue/entities/venue.entity';
import { ScheduleTemplate } from '../schedule/schedule_template.entity';
  
  @Entity()
  export class Club {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @ManyToOne(() => User, (user) => user.club, { onDelete: 'CASCADE' })
    owner: User;
  
    @Column()
    name: string;
  
    @Column()
    email: string;
  
    @Column()
    phone: string;
  
    @Column()
    address: string;
  
    @Column({ nullable: true })
    district: string;
  
    @Column()
    description: string;
  
    @Column({ nullable: true })
    logo?: string;
  
    @Column('text', { array: true, default: [] })
    images: string[];
  
    @Column('json', { nullable: true })
    socialMedia?: {
      facebook?: string;
      instagram?: string;
      twitter?: string;
    };
  
    @Column('json', { nullable: true })
    coordinates: {
      lat: number;
      lng: number;
    };
  
    @Column('text', { array: true, default: [] })
    services: string[];
  
    @Column({ default: 'PENDING' })
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  
    @Column({ nullable: true })
    approvedAt?: Date;

    @Column({ type: 'timestamp', nullable: true })
    trialStartDate?: Date;

    @Column({ type: 'timestamp', nullable: true })
    trialEndDate?: Date;
  
    @CreateDateColumn()
    createdAt: Date;
    // Mercado pago tokens
    @Column({ nullable: true })
    mpUserId: string;

    @Column({ nullable: true })
    mpAccessToken: string;

    @Column({ nullable: true })
    mpRefreshToken: string;

    @Column({ nullable: true })
    mpTokenExpiresAt: Date;

    // Dentro de la clase Club:
    @OneToMany(() => Booking, (booking) => booking.club)
    bookings: Booking[];
  
    @UpdateDateColumn()
    updatedAt: Date;

    @OneToMany(() => Promotion, (promotion) => promotion.club)
    promotions: Promotion[];

    @OneToMany(() => Review, (review) => review.club)
    reviews: Review[];

    @OneToMany(() => Venue, (venue) => venue.club)
    venues: Venue[]
  // opcional, por si quieres acceso inverso
    @OneToMany(() => ScheduleTemplate, (template) => template.club)
    scheduleTemplates: ScheduleTemplate[];

    @OneToMany('ClubMembership', (membership: any) => membership.club)
    memberships: any[];
  }
  