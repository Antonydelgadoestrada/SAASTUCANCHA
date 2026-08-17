// src/user/user.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from './user.entity';
import { UserRole } from './user-role.enum';
import { instanceToPlain } from 'class-transformer';

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
    const users = await  this.userRepository.find({
      where:{role : UserRole.CLUB},
      relations:['club']
    });
    return instanceToPlain(users);
  }

  async findOneById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id }, relations:['club'] });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | undefined> {
    return this.userRepository.findOne({ where: { email } , relations:['club'] });
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
