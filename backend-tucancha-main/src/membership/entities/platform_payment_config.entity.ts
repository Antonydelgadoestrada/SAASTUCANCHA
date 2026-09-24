import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('platform_payment_config')
export class PlatformPaymentConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: 'mercadopago', unique: true })
  provider: string; // 'mercadopago'

  @Column({ nullable: true })
  mpUserId: string; // Collector ID del Admin

  @Column({ nullable: true, select: false })
  mpAccessToken: string; // Access Token de la plataforma (oculto en selects ordinarios por seguridad)

  @Column({ nullable: true, select: false })
  mpRefreshToken: string; // Refresh Token para renovación automática

  @Column({ nullable: true })
  mpPublicKey: string; // Llave pública para frontend / checkout si aplica

  @Column({ type: 'timestamp', nullable: true })
  mpTokenExpiresAt: Date;

  @Column({ default: false })
  isConnected: boolean;

  @Column({ nullable: true })
  accountEmail: string;

  @Column({ nullable: true })
  accountNickname: string;

  @Column({ default: 'production' })
  environment: string; // 'production' | 'sandbox'

  @Column({ default: true })
  liveMode: boolean;

  @Column({ type: 'timestamp', nullable: true })
  connectedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncAt: Date;

  @Column({ nullable: true })
  connectedByUserId: string;

  @Column({ nullable: true })
  updatedByUserId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
