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
import { Court } from '../court/court.entity';
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

    // Configuración de recaudación y pagos
    @Column({ default: false })
    aceptaMercadopago: boolean;

    @Column({ nullable: true })
    whatsapp?: string;

    @Column({ nullable: true })
    yapeNumero?: string;

    @Column({ nullable: true })
    yapeQrUrl?: string;

    @Column({ nullable: true })
    yapeTitular?: string;

    @Column({ nullable: true })
    plinNumero?: string;

    @Column({ nullable: true })
    plinQrUrl?: string;

    @Column({ nullable: true })
    plinTitular?: string;

    @Column({ type: 'int', default: 50 })
    porcentajeAdelantoDefault: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    adelantoMinimo?: number;

    // Dentro de la clase Club:
    @OneToMany(() => Booking, (booking) => booking.club)
    bookings: Booking[];
  
    @UpdateDateColumn()
    updatedAt: Date;

    @OneToMany(() => Promotion, (promotion) => promotion.club)
    promotions: Promotion[];

    @OneToMany(() => Review, (review) => review.club)
    reviews: Review[];

    @OneToMany(() => Court, (court) => court.club)
    courts: Court[]
  // opcional, por si quieres acceso inverso
    @OneToMany(() => ScheduleTemplate, (template) => template.club)
    scheduleTemplates: ScheduleTemplate[];

    @OneToMany('ClubMembership', (membership: any) => membership.club)
    memberships: any[];
  }
  