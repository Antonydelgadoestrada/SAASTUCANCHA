import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from './user.entity';
import { Club } from '../club/club.entity';
import { UserRole } from './user-role.enum';
import { instanceToPlain } from 'class-transformer';
import * as bcrypt from 'bcrypt';
import { MailerService } from '../mailer/mailer.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Optional()
    @InjectRepository(Club)
    private readonly clubRepository: Repository<Club>,
    private readonly dataSource: DataSource,
    @Optional()
    private readonly mailerService?: MailerService,
  ) {}

  async getAdminDashboardStats(): Promise<any> {
    const totalUsers = await this.userRepository.count();
    
    const activeClubs = await this.dataSource.getRepository('Club').count({
      where: { status: 'APPROVED' }
    });

    const payments = await this.dataSource.getRepository('Payment').find({
      where: { status: 'paid' }
    });
    const totalIncome = payments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

    const totalBookings = await this.dataSource.getRepository('Booking').count();

    const recentUsers = await this.userRepository.find({
      order: { createdAt: 'DESC' },
      take: 5,
      relations: ['club']
    });

    const recentRequests = await this.dataSource.getRepository('Club').find({
      where: { status: 'PENDING' },
      order: { createdAt: 'DESC' },
      take: 5
    });

    const chartData = [
      { name: "Ene", usuarios: Math.max(1, Math.round(totalUsers * 0.2)), clubes: Math.max(1, Math.round(activeClubs * 0.2)), reservas: Math.max(1, Math.round(totalBookings * 0.2)) },
      { name: "Feb", usuarios: Math.max(1, Math.round(totalUsers * 0.4)), clubes: Math.max(1, Math.round(activeClubs * 0.3)), reservas: Math.max(1, Math.round(totalBookings * 0.4)) },
      { name: "Mar", usuarios: Math.max(1, Math.round(totalUsers * 0.5)), clubes: Math.max(1, Math.round(activeClubs * 0.5)), reservas: Math.max(1, Math.round(totalBookings * 0.5)) },
      { name: "Abr", usuarios: Math.max(1, Math.round(totalUsers * 0.7)), clubes: Math.max(1, Math.round(activeClubs * 0.6)), reservas: Math.max(1, Math.round(totalBookings * 0.6)) },
      { name: "May", usuarios: Math.max(1, Math.round(totalUsers * 0.9)), clubes: Math.max(1, Math.round(activeClubs * 0.8)), reservas: Math.max(1, Math.round(totalBookings * 0.8)) },
      { name: "Jun", usuarios: totalUsers, clubes: activeClubs, reservas: totalBookings },
    ];

    return {
      stats: {
        totalUsers,
        activeClubs,
        totalIncome,
        totalBookings,
      },
      recentUsers,
      recentRequests,
      chartData,
    };
  }

  async findAll(): Promise<any> {
    const users = await this.userRepository.find({
      where: { role: UserRole.CLUB },
      relations: ['club']
    });
    return instanceToPlain(users);
  }

  async findOneById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['club', 'associatedClub'],
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    if (!user.club && user.associatedClub) {
      user.club = user.associatedClub;
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const user = await this.userRepository.findOne({ 
      where: { email: email.toLowerCase().trim() }, 
      relations: ['club', 'associatedClub'] 
    });
    if (user && !user.club && user.associatedClub) {
      user.club = user.associatedClub;
    }
    return user;
  }

  /**
   * Obtiene todos los usuarios de staff asignados a un club
   */
  async findStaffByClub(clubId: string): Promise<any[]> {
    const users = await this.userRepository.find({
      where: { clubId },
      order: { createdAt: 'DESC' },
    });
    return instanceToPlain(users) as any[];
  }

  /**
   * Obtiene los correos de los recepcionistas activos de un club
   */
  async findActiveReceptionistEmails(clubId: string): Promise<string[]> {
    if (!clubId) return [];
    try {
      const users = await this.userRepository.find({
        where: {
          clubId,
          role: UserRole.RECEPCIONISTA,
          isActive: true,
        },
        select: ['email'],
      });
      return users.map((u) => u.email).filter(Boolean);
    } catch (e) {
      return [];
    }
  }

  /**
   * Registra un nuevo usuario para el club (ej. Recepcionista)
   */
  async createStaffUser(clubId: string, dto: CreateStaffDto): Promise<any> {
    const cleanEmail = dto.email.toLowerCase().trim();
    const existing = await this.findByEmail(cleanEmail);
    if (existing) {
      throw new ConflictException('El correo ya se encuentra registrado en el sistema');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const newUser = this.userRepository.create({
      name: dto.name.trim(),
      email: cleanEmail,
      role: dto.role,
      password: hashedPassword,
      clubId,
      isActive: true,
      isVerified: true,
    });

    const savedUser = await this.userRepository.save(newUser);

    // Obtener información del club para enviar el correo personalizado
    let clubName = 'Tu Club Deportivo';
    try {
      const club = await this.dataSource.getRepository(Club).findOne({ where: { id: clubId } });
      if (club?.name) clubName = club.name;
    } catch (err) {
      // Ignorar fallo de consulta de club
    }

    if (this.mailerService) {
      this.mailerService.sendClubStaffWelcomeEmail({
        to: savedUser.email,
        staffName: savedUser.name,
        clubName,
        role: savedUser.role,
        temporaryPassword: dto.password,
      }).catch((err) => {
        console.warn('⚠️ No se pudo enviar correo de bienvenida al personal:', err?.message);
      });
    }

    return instanceToPlain(savedUser);
  }

  /**
   * Actualiza datos de un usuario de staff
   */
  async updateStaffUser(clubId: string, userId: string, dto: UpdateStaffDto): Promise<any> {
    const user = await this.userRepository.findOne({ where: { id: userId, clubId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado en este club');
    }

    if (dto.email && dto.email.toLowerCase().trim() !== user.email) {
      const existing = await this.findByEmail(dto.email.toLowerCase().trim());
      if (existing && existing.id !== user.id) {
        throw new ConflictException('El nuevo correo ya está en uso por otro usuario');
      }
      user.email = dto.email.toLowerCase().trim();
    }

    if (dto.name) {
      user.name = dto.name.trim();
    }

    if (dto.role) {
      user.role = dto.role;
    }

    if (dto.password && dto.password.trim().length >= 6) {
      user.password = await bcrypt.hash(dto.password.trim(), 10);
    }

    const updated = await this.userRepository.save(user);
    return instanceToPlain(updated);
  }

  /**
   * Activa o desactiva el acceso de un usuario de staff
   */
  async toggleStaffStatus(clubId: string, userId: string): Promise<any> {
    const user = await this.userRepository.findOne({ where: { id: userId, clubId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado en este club');
    }

    user.isActive = !user.isActive;
    const updated = await this.userRepository.save(user);
    return instanceToPlain(updated);
  }

  /**
   * Elimina un usuario de staff del club
   */
  async removeStaffUser(clubId: string, userId: string, requestingUser: User): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId, clubId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado en este club');
    }

    if (user.id === requestingUser.id) {
      throw new BadRequestException('No puedes eliminar tu propio usuario');
    }

    await this.userRepository.delete(userId);
    return { message: 'Usuario eliminado exitosamente' };
  }

  async create(user: Partial<User>): Promise<User> {
    const newUser = this.userRepository.create(user);
    return this.userRepository.save(newUser);
  }

  async update(id: string, partialUser: Partial<User>): Promise<User> {
    await this.userRepository.update(id, partialUser);
    return this.findOneById(id);
  }

  async remove(id: string): Promise<void> {
    await this.userRepository.delete(id);
  }
}
