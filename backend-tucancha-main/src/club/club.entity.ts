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
import * as crypto from 'crypto';

export class EncryptionTransformer {
  private readonly algorithm = 'aes-256-cbc';
  private readonly key: Buffer;

  constructor() {
    const secret = process.env.ENCRYPTION_SECRET || 'tucancha-secure-secret-key-32-chr';
    this.key = crypto.scryptSync(secret, 'salt', 32);
  }

  to(data: string | null): string | null {
    if (!data) return data;
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return `${iv.toString('hex')}:${encrypted}`;
    } catch (e) {
      return data; // Fallback
    }
  }

  from(data: string | null): string | null {
    if (!data) return data;
    if (!data.includes(':')) return data; // Retrocompatibilidad para tokens viejos no encriptados
    try {
      const [ivHex, encrypted] = data.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      return data; // Si falla la desencriptación retorna raw
    }
  }
}
  
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

    @Column({ nullable: true, transformer: new EncryptionTransformer() })
    mpAccessToken: string;

    @Column({ nullable: true, transformer: new EncryptionTransformer() })
    mpRefreshToken: string;

    @Column({ nullable: true })
    mpTokenExpiresAt: Date;

    // Configuración de recaudación y pagos
    @Column({ default: false })
    aceptaMercadopago: boolean;

    @Column({ default: true })
    aceptaYape: boolean;

    @Column({ default: true })
    aceptaPlin: boolean;

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
  