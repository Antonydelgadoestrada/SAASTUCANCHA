import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  Index,
} from 'typeorm';
import { Booking } from '../booking/booking.entity';
import { User } from '../user/user.entity';
import { PaymentStatus } from './payment-status.enum';
import { PaymentMethod } from './payment-method.enum';

export enum PaymentType {
  ADELANTO = 'ADELANTO',
  SALDO = 'SALDO',
  PAGO_COMPLETO = 'PAGO_COMPLETO',
}

export enum SaldoStatus {
  PENDIENTE = 'PENDIENTE',
  PAGADO = 'PAGADO',
  NO_APLICA = 'NO_APLICA',
}

@Entity()
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToMany(() => Booking, (booking) => booking.payment, { onDelete: 'CASCADE' })
  bookings: Booking[];

  @ManyToOne(() => User, (user) => user.payments, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  // Monto total del pago
  @Column({ type: 'float', default: 0 })
  amount: number;

  // Moneda, ej. 'PEN'
  @Column()
  currency: string;

  // Método de pago (enum: MERCADOPAGO, YAPE, PLIN, etc.)
  @Column({ type: 'enum', enum: PaymentMethod })
  method: PaymentMethod;

  @Column({ nullable: true })
  paymentMethod?: string;

  // Estado del pago (PENDING, PAID, CANCELLED, REJECTED)
  @Column({ type: 'enum', enum: PaymentStatus })
  status: PaymentStatus;

  // Tipo de pago: ADELANTO / SALDO / PAGO_COMPLETO
  @Column({ type: 'enum', enum: PaymentType, default: PaymentType.PAGO_COMPLETO })
  type: PaymentType;

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

  // URL del comprobante de pago subido por el usuario (Yape/Plin)
  @Column({ nullable: true })
  comprobanteUrl?: string;

  // Motivo de rechazo del comprobante (auditado por el club)
  @Column({ nullable: true })
  motivoRechazo?: string;

  // Fecha en que el club confirmó o rechazó el comprobante
  @Column({ type: 'timestamp', nullable: true })
  fechaConfirmacion?: Date;

  // Usuario del club que auditó este pago
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'confirmadoPorId' })
  confirmadoPor?: User;

  // ─── CONTROL Y LIQUIDACIÓN DE SALDO RESTANTE ───
  // Estado de liquidación del saldo restante
  @Column({ type: 'varchar', default: 'PENDIENTE', nullable: true })
  saldoStatus?: string; // 'PENDIENTE' | 'PAGADO' | 'NO_APLICA'

  // Monto cobrado al liquidar el saldo restante
  @Column({ type: 'float', default: 0, nullable: true })
  saldoAmount?: number;

  // Método con el que se cobró el saldo restante (EFECTIVO, YAPE, PLIN, TRANSFERENCIA, MERCADOPAGO)
  @Column({ nullable: true })
  saldoMethod?: string;

  // Comprobante de cancelación de saldo (opcional)
  @Column({ nullable: true })
  saldoComprobanteUrl?: string;

  // Fecha en que se cobró o confirmó el saldo restante
  @Column({ type: 'timestamp', nullable: true })
  saldoFechaConfirmacion?: Date;

  // Notas adicionales del cobro del saldo (ej. "Cobrado en efectivo en recepción")
  @Column({ nullable: true })
  saldoNotas?: string;

  // Usuario del club que cobró/confirmó el saldo restante
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'saldoConfirmadoPorId' })
  saldoConfirmadoPor?: User;

  @Column({ default: false })
  autoConfirmed: boolean;

  @Column({ default: false })
  pendingAudit: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

