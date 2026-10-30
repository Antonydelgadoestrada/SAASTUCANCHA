// src/user/user.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { UserRole } from './user-role.enum';
import { Club } from '../club/club.entity';
import { instanceToPlain } from 'class-transformer';
import { CreateClubUserDto } from './dto/create-club-user.dto';
import { UpdateClubUserDto } from './dto/update-club-user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async getAdminDashboardStats(): Promise<any> {
    const totalUsers = await this.userRepository.count();

    const activeClubs = await this.dataSource.getRepository('Club').count({
      where: { status: 'APPROVED' },
    });

    const payments = await this.dataSource.getRepository('Payment').find({
      where: { status: 'paid' },
    });
    const totalIncome = payments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

    const totalBookings = await this.dataSource.getRepository('Booking').count();

    const recentUsers = await this.userRepository.find({
      order: { createdAt: 'DESC' },
      take: 5,
      relations: ['club'],
    });

    const recentRequests = await this.dataSource.getRepository('Club').find({
      where: { status: 'PENDING' },
      order: { createdAt: 'DESC' },
      take: 5,
    });

    const chartData = [
      { name: 'Ene', usuarios: Math.max(1, Math.round(totalUsers * 0.2)), clubes: Math.max(1, Math.round(activeClubs * 0.2)), reservas: Math.max(1, Math.round(totalBookings * 0.2)) },
      { name: 'Feb', usuarios: Math.max(1, Math.round(totalUsers * 0.4)), clubes: Math.max(1, Math.round(activeClubs * 0.3)), reservas: Math.max(1, Math.round(totalBookings * 0.4)) },
      { name: 'Mar', usuarios: Math.max(1, Math.round(totalUsers * 0.5)), clubes: Math.max(1, Math.round(activeClubs * 0.5)), reservas: Math.max(1, Math.round(totalBookings * 0.5)) },
      { name: 'Abr', usuarios: Math.max(1, Math.round(totalUsers * 0.7)), clubes: Math.max(1, Math.round(activeClubs * 0.6)), reservas: Math.max(1, Math.round(totalBookings * 0.6)) },
      { name: 'May', usuarios: Math.max(1, Math.round(totalUsers * 0.9)), clubes: Math.max(1, Math.round(activeClubs * 0.8)), reservas: Math.max(1, Math.round(totalBookings * 0.8)) },
      { name: 'Jun', usuarios: totalUsers, clubes: activeClubs, reservas: totalBookings },
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
      relations: ['club'],
    });
    return instanceToPlain(users);
  }

  async findOneById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['club', 'assignedClub'],
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    // Compatibilidad retroactiva: para un recepcionista, user.club se asigna desde assignedClub
    if (!user.club && user.assignedClub) {
      user.club = user.assignedClub;
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const user = await this.userRepository.findOne({
      where: { email: email.toLowerCase().trim() },
      relations: ['club', 'assignedClub'],
    });
    if (user && !user.club && user.assignedClub) {
      user.club = user.assignedClub;
    }
    return user || undefined;
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

  // =========================================================================
  // MÓDULO DE USUARIOS POR CLUB (RECEPCIONISTAS)
  // =========================================================================

  /**
   * Lista todos los usuarios secundarios (recepcionistas) del club autenticado.
   * Excluye usuarios con borrado lógico (deletedAt IS NOT NULL).
   */
  async findStaffByClub(clubId: string): Promise<any[]> {
    if (!clubId) {
      throw new BadRequestException('ID de club no proporcionado');
    }
    const staff = await this.userRepository.find({
      where: {
        assignedClubId: clubId,
        deletedAt: IsNull(),
      },
      order: { createdAt: 'DESC' },
    });
    return instanceToPlain(staff) as any[];
  }

  /**
   * Crea un nuevo recepcionista asociado exclusivamente al club autenticado.
   */
  async createStaffUser(clubId: string, dto: CreateClubUserDto): Promise<any> {
    if (!clubId) {
      throw new BadRequestException('ID de club no proporcionado');
    }

    const normalizedEmail = dto.email.toLowerCase().trim();
    const existing = await this.findByEmail(normalizedEmail);
    if (existing) {
      throw new ConflictException('El correo ya está registrado en la plataforma');
    }

    const club = await this.dataSource.getRepository(Club).findOne({
      where: { id: clubId },
    });
    if (!club) {
      throw new NotFoundException('Club no encontrado');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const uniquePermissions = Array.from(new Set(dto.permissions || []));

    const newStaff = this.userRepository.create({
      name: dto.name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      phone: dto.phone?.trim() || null,
      role: UserRole.RECEPCIONISTA,
      assignedClubId: clubId,
      permissions: uniquePermissions,
      isActive: true,
      isVerified: true, // Pre-verificado por el administrador del club
    });

    const saved = await this.userRepository.save(newStaff);
    return instanceToPlain(saved);
  }

  /**
   * Actualiza los datos de un recepcionista de un club específico.
   * Garantiza aislamiento estricto por clubId.
   */
  async updateStaffUser(clubId: string, userId: string, dto: UpdateClubUserDto): Promise<any> {
    if (!clubId || !userId) {
      throw new BadRequestException('Parámetros de club o usuario faltantes');
    }

    const staff = await this.userRepository.findOne({
      where: {
        id: userId,
        assignedClubId: clubId,
        deletedAt: IsNull(),
      },
    });

    if (!staff) {
      throw new NotFoundException('Usuario no encontrado en este club');
    }

    if (dto.name !== undefined) {
      staff.name = dto.name.trim();
    }
    if (dto.phone !== undefined) {
      staff.phone = dto.phone ? dto.phone.trim() : null;
    }
    if (dto.permissions !== undefined) {
      staff.permissions = Array.from(new Set(dto.permissions));
    }
    if (dto.isActive !== undefined) {
      staff.isActive = dto.isActive;
    }
    if (dto.password) {
      staff.password = await bcrypt.hash(dto.password, 10);
    }

    const updated = await this.userRepository.save(staff);
    return instanceToPlain(updated);
  }

  /**
   * Activa o desactiva el acceso de un recepcionista.
   */
  async toggleStaffStatus(clubId: string, userId: string, isActive: boolean): Promise<any> {
    return this.updateStaffUser(clubId, userId, { isActive });
  }

  /**
   * Borrado lógico (soft delete) del recepcionista.
   * Preserva relaciones con reservas, pagos auditados y logs históricos.
   */
  async softDeleteStaffUser(clubId: string, userId: string): Promise<{ success: boolean; message: string }> {
    if (!clubId || !userId) {
      throw new BadRequestException('Parámetros de club o usuario faltantes');
    }

    const staff = await this.userRepository.findOne({
      where: {
        id: userId,
        assignedClubId: clubId,
        deletedAt: IsNull(),
      },
    });

    if (!staff) {
      throw new NotFoundException('Usuario no encontrado en este club');
    }

    staff.deletedAt = new Date();
    staff.isActive = false;
    await this.userRepository.save(staff);

    return {
      success: true,
      message: 'Usuario eliminado correctamente del club',
    };
  }
}
