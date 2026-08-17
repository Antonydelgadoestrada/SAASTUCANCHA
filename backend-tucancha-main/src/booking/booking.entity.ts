  import {
      Entity,
      PrimaryGeneratedColumn,
      Column,
      ManyToOne,
      CreateDateColumn,
      UpdateDateColumn,
      JoinColumn,
      OneToOne,
    } from 'typeorm';
  import { User } from '../user/user.entity';
  import { Court } from '../court/court.entity';
  import { Club } from '../club/club.entity';
  import { BookingStatus } from './booking-status.enum';
  import { Payment } from '../payment/payment.entity';
  import { Review } from '../review/review.entity';
  import { PaymentStatus } from '../payment/payment-status.enum';
  
  @Entity()
  export class Booking {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @ManyToOne(() => User, (user) => user.bookings)
    user: User;
  
    @ManyToOne(() => Court, (court) => court.bookings)
    court: Court;
  
    @ManyToOne(() => Club, (club) => club.bookings)
    club: Club;

    @Column()
    date: Date;
  
    @Column()
    startTime: string;
  
    @Column()
    endTime: string;
  
    @Column()
    duration: number;
  
    @Column('jsonb')
    customerInfo: {
      name: string;
      email: string;
      phone: string;
      notes?: string;
    };
  
    @Column({
      type:'jsonb',
      nullable: true 
    })
    pricing: {
      basePrice: number;
      discounts: number;
      taxes: number;
      totalPrice: number;
    };
  
    @Column({
      type: 'enum',
      enum: BookingStatus,
      default: BookingStatus.PENDING,
    })
    status: BookingStatus;
  
    @Column({
      type: 'enum',
      enum: PaymentStatus,
      default: PaymentStatus.PENDING,
    })
    paymentStatus: PaymentStatus;
  
    @Column()
    bookingReference: string;
  
    @CreateDateColumn()
    createdAt: Date;

    @Column({ type: 'timestamp', nullable: true })
    notifiedAt?: Date;

    @UpdateDateColumn()
    updatedAt: Date;
  
    @Column({ nullable: true })
    cancelledAt?: Date;
  
    @Column({ nullable: true })
    cancellationReason?: string;
  
    @OneToOne(() => Payment, (payment) => payment.booking, { nullable: true })
    @JoinColumn()
    payment?: Payment;

    @OneToOne(() => Review, (review) => review.booking)
    review?: Review;

    @Column({ type: 'enum', enum: ['online', 'manual'], default: 'online' })
    paymentMethod: 'online' | 'manual';

    @Column({ nullable: true })
    proofOfPaymentUrl?: string;

    @Column({ type: 'timestamp', nullable: true })
    paymentDueDate?: Date;

  }
  