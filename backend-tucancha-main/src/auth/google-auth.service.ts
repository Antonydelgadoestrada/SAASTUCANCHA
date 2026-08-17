// src/auth/google-auth.service.ts (puedes también poner esto en tu AuthService)
import { Injectable } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../user/user-role.enum';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class GoogleAuthService {
  private client: OAuth2Client;

  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {
    this.client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }

  async verifyGoogleToken(idToken: string) {
    try{
      if(!process.env.GOOGLE_CLIENT_ID) throw new Error(`No existe GOOGLE_CLIENT_ID : ${process.env.GOOGLE_CLIENT_ID} `)
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
  
      const payload = ticket.getPayload();
  
      if (!payload || !payload.email_verified) {
        throw new Error('Correo no verificado por Google');
      }
  
      // Buscar o crear el usuario
      let user = await this.userService.findByEmail(payload.email);
  
      if (!user) {
        const rawPassword = randomBytes(12).toString('hex'); // genera string aleatorio
        const hashedPassword = await bcrypt.hash(rawPassword, 10); // lo convierte a hash
        user = await this.userService.create({
          email: payload.email,
          name: payload.name,
          password: hashedPassword,
          avatar: payload.picture,
          role: UserRole.USER,
          isVerified: true, // Ya validado por Google
        });
      }
      let data = { id: user.id, name:user.name, email: user.email, role: user.role}
      // Retornar el token del sistema
      const access_token = this.jwtService.sign(data);
      const refresh_token = this.jwtService.sign({ sub: user.id }, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '7d',
      });
      await this.userService.update(user.id, {refreshToken:refresh_token})
  
      return {
        access_token,
        refresh_token
      };
    }catch(error){
      throw new Error(`Fallo al verificar token de Google ID: ` + error.message)
    }
  }
}
