import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Booking } from '../booking/booking.entity';
import { User } from '../user/user.entity';
import { PaymentStatus } from './payment-status.enum';
import { PaymentMethod } from './payment-method.enum';

@Entity()
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Booking, (booking) => booking.payment, { onDelete: 'CASCADE' })
  @JoinColumn()
  booking: Booking;

  @ManyToOne(() => User, (user) => user.payments, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  // Monto total del pago
  @Column()
  amount: number;

  // Moneda, ej. 'PEN'
  @Column()
  currency: string;

  // Método de pago (enum: MERCADOPAGO, MANUAL, etc.)
  @Column({ type: 'enum', enum: PaymentMethod })
  method: PaymentMethod;

  @Column({ nullable: true })
  paymentMethod?: string;

  // Estado del pago (PENDING, PAID, CANCELLED, REJECTED)
  @Column({ type: 'enum', enum: PaymentStatus })
  status: PaymentStatus;

  // ID de transacción en Mercado Pago
  @Index()
  @Column({ nullable: true })
  transactionId?: string;

  // Monto neto recibido (descontando comisiones)
  @Column({ nullable: true, type: 'float' })
  netAmount?: number;

  // Comisión cobrada por Mercado Pago
  @Column({ nullable: true, type: 'float' })
  feeAmount?: number;

  // Método de pago específico usado (credit_card, debit_card, etc.)
  @Column({ nullable: true })
  paymentType?: string;

  // Detalles completos de la pasarela
  @Column({ type: 'jsonb', nullable: true })
  gatewayResponse?: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
