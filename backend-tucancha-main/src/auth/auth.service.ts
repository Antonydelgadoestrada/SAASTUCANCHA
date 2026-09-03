import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { User } from '../user/user.entity';
import { UserRole } from '../user/user-role.enum';
import { Club } from '../club/club.entity';
import { UserService } from '../user/user.service';
import { MailerService } from '../mailer/mailer.service';
import { GoogleAuthService } from './google-auth.service';
import { Response } from 'express';
import { error } from 'console';
@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Club)
    private readonly clubRepository: Repository<Club>,
    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService,
    private readonly googleAuthService: GoogleAuthService,
  ) {}

  async login(loginDto: LoginDto): Promise<{ access_token: string, refresh_token:string }> {
    const { email, password } = loginDto;
    const user = await this.userService.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (!user.isVerified) {
      if (process.env.NODE_ENV !== 'production') {
        user.isVerified = true;
        await this.userRepository.save(user);
      } else {
        throw new UnauthorizedException('Debes confirmar tu cuenta por correo');
      }
    }
    // let payload = { id: user.id, name:user.name, email: user.email, role: user.role}
    let payload = { sub: user.id, name: user.name, email: user.email, role: user.role }
    
    if (user.club) {
      if (user.club.status === 'PENDING') {
        throw new UnauthorizedException('El administrador debe aceptar el club');
      }

      // Chequeo dinámico de prueba gratuita
      if (user.club.status === 'APPROVED' && user.club.trialEndDate && new Date(user.club.trialEndDate) < new Date()) {
        const activeMembership = await this.clubRepository.manager.createQueryBuilder()
          .select('cm')
          .from('club_memberships', 'cm')
          .where('cm.clubId = :clubId', { clubId: user.club.id })
          .andWhere('cm.status IN (:...statuses)', { statuses: ['ACTIVE', 'GRACE'] })
          .getOne();

        if (!activeMembership) {
          user.club.status = 'SUSPENDED';
          await this.clubRepository.save(user.club);
        }
      }
    }

    if (user.role === 'CLUB') {
      payload = Object.assign(payload, { clubId: user.club.id })
    }
    
    const refresh_token = this.jwtService.sign({ sub: user.id }, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d', // duración del refresh token
    });
    await this.userService.update(user.id, {refreshToken:refresh_token})
    return { access_token: this.jwtService.sign(payload), refresh_token };
  }

  async refreshToken(refreshToken){
    const decoded = this.jwtService.verify(refreshToken, {
      secret: process.env.JWT_REFRESH_SECRET,
    });
  
    const user = await this.userService.findOneById(decoded.sub);
  
    if (!user || user.refreshToken !== refreshToken) {
      throw new UnauthorizedException('Refresh token inválido');
    }
  
    const payload = {
      sub: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      ...(user.role === 'CLUB' && { clubId: user.club.id }),
    };
  
    const newAccessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: '15m',
    });
  
    return { access_token: newAccessToken };
  }

  async loginWithGoogle(idToken: string) {
    return this.googleAuthService.verifyGoogleToken(idToken);
  }

  buildHtml(message: string): string {
    return `
      <html>
        <head>
          <title>Confirmación</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              background-color: #f4f4f4;
              text-align: center;
              padding: 50px;
            }
            .box {
              background: white;
              padding: 30px;
              border-radius: 8px;
              display: inline-block;
              box-shadow: 0 0 10px rgba(0,0,0,0.1);
            }
            .box h1 {
              color: #16A34A;
            }
          </style>
        </head>
        <body>
          <div class="box">
            <h1>${message}</h1>
            <p>Puedes cerrar esta ventana.</p>
          </div>
        </body>
      </html>
    `;
  }

  async confirm(token: string, res: Response) {
    let payload: any;
  
    try {
      payload = this.jwtService.verify(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.send(this.buildHtml('El enlace de confirmación ha expirado.'));
      }
      return res.send(this.buildHtml('Enlace inválido.'));
    }
  
    const user = await this.userRepository.findOne({ where: { email: payload.email } });
    if (!user) {
      return res.send(this.buildHtml('Usuario no encontrado.'));
    }
  
    if (user.isVerified) {
      return res.send(this.buildHtml('Tu cuenta ya estaba confirmada.'));
    }
  
    if (user.emailConfirmationToken !== token) {
      return res.send(this.buildHtml('El token no coincide.'));
    }
  
    user.isVerified = true;
    user.emailConfirmationToken = null;
    await this.userRepository.save(user);
  
    return res.send(this.buildHtml('Tu cuenta ha sido confirmada con éxito.'));
  }
  
  async register(registerDto: RegisterDto) {
    const { email, password, name, role, club } = registerDto;
  
    const existing = await this.userService.findByEmail(email);
    if (existing) throw new ConflictException('El correo ya está registrado');
  
    const isDev = process.env.NODE_ENV !== 'production';
    const hashedPassword = await bcrypt.hash(password, 10);
    const emailToken = this.jwtService.sign({ email }, { expiresIn: '10m' });
  
    const newUser = this.userRepository.create({
      email,
      password: hashedPassword,
      name,
      role,
      isVerified: isDev,
      emailConfirmationToken: emailToken,
    });
  
    const savedUser = await this.userRepository.save(newUser);
  
    let createdClub = null;
    try {
      // Si es usuario regular (jugador), enviar correo de bienvenida
      if (role !== UserRole.CLUB) {
        await this.mailerService.sendUserWelcomeEmail(email, name, emailToken);
      }

      // Si es club, crear el club y enviar notificaciones de espera y alerta a admin
      if (role === UserRole.CLUB) {
        if (!club) throw new BadRequestException('Información del club requerida para rol CLUB');

        const newClub = this.clubRepository.create({
          ...club,
          email: email,
          owner: savedUser,
          status: 'PENDING',
        });

        createdClub = await this.clubRepository.save(newClub);
        try {
          const adminEmail = process.env.ADMIN_EMAIL || 'tucancha100@gmail.com';
          await this.mailerService.sendClubRegisteredPendingApprovalEmail(savedUser.email, createdClub, savedUser.name);
          await this.mailerService.sendNewClubAdminNotificationEmail(adminEmail, createdClub, savedUser);
        } catch (mailErr) {
          console.warn('⚠️ No se pudieron enviar correos de notificación de club:', mailErr?.message);
        }
      }

      return {
        message: 'Usuario registrado correctamente.' + (isDev ? ' Cuenta verificada automáticamente en modo desarrollo.' : ' Revisa tu correo para confirmar tu cuenta.'),
        user: {
          id: savedUser.id,
          name: savedUser.name,
          email: savedUser.email,
          role: savedUser.role
        },
      };

    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ConflictException) {
        throw error;
      }
      console.warn('⚠️ Error secundario durante registro:', error?.message);
      return {
        message: 'Usuario registrado correctamente.',
        user: {
          id: savedUser.id,
          name: savedUser.name,
          email: savedUser.email,
          role: savedUser.role
        },
      };
    }
  }
  
  async sendResetPasswordEmail(email: string) {
    const user = await this.userService.findByEmail(email);
    if (!user) throw new NotFoundException('Usuario no encontrado');
  
    const token = this.jwtService.sign(
      { sub: user.id },
      { expiresIn: '20m' },
    );
  
    await this.mailerService.sendResetPasswordEmail(user.email, token);
  
    return { message: 'Se ha enviado un correo para restablecer tu contraseña' };
  }

  async resetPassword(token: string, newPassword: string) {
    try {
      const payload = this.jwtService.verify(token);
      const user = await this.userService.findOneById(payload.sub);
      if (!user) throw new NotFoundException('Usuario no encontrado');

      const hashed = await bcrypt.hash(newPassword, 10);
      user.password = hashed;

      await this.userService.update(user.id, {password: hashed});

      return { message: 'Contraseña restablecida correctamente' };
    } catch (e) {
      throw new BadRequestException('Token inválido o expirado');
    }
  }
  
}
