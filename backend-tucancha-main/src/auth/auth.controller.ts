// src/auth/auth.controller.ts
import { Controller, Post, Body, Get, Query, UsePipes, ValidationPipe, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('register')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Get('confirm')
  async confirm(@Query('token') token: string, @Res({ passthrough: false }) res: Response) {
    return this.authService.confirm(token, res)
  }

  // auth.controller.ts
  @Post('forgot-password')
  async forgotPassword(@Body('email') email: string) {
    return this.authService.sendResetPasswordEmail(email);
  }

  @Post('reset-password')
  async resetPassword(
    @Body('token') token: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.authService.resetPassword(token, newPassword);
  }
  
  @Post('refresh')
  async refresh(@Body('refresh_token') refreshToken: string) {
   return this.authService.refreshToken(refreshToken);
  }
  

  @Post('google')
  async loginWithGoogle(@Body('idToken') idToken: string) {
    return this.authService.loginWithGoogle(idToken);
  }
}
