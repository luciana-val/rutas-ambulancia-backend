import { Controller, Post, Body, Get, Request, Res, Req } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiTags } from '@nestjs/swagger';
import type { Response, Request as ExpressRequest } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UsersService } from '../users/users.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private jwtService: JwtService,
    private usersService: UsersService,
  ) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    this.setTokenCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    this.setTokenCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  @Public()
  @Post('refresh')
  async refresh(@Req() req: ExpressRequest, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.['refresh_token'];
    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token not found' });
    }
    const result = await this.authService.refresh(refreshToken);
    this.setAccessTokenCookie(res, result.accessToken);
    return { user: result.user };
  }

  @Public()
  @Post('logout')
  async logout(@Req() req: ExpressRequest, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.['refresh_token'];
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    this.clearTokenCookies(res);
    return { message: 'Logged out' };
  }

  @Get('profile')
  async getProfile(@Req() req: ExpressRequest) {
    const token = req.cookies?.['access_token'];
    if (!token) return null;
    try {
      const payload = this.jwtService.verify<{ sub: string }>(token);
      const user = await this.usersService.findOne(payload.sub);
      return { id: user.id, username: user.username, role: user.role, name: user.name, hospitalId: user.hospitalId };
    } catch {
      return null;
    }
  }

  private setTokenCookies(res: Response, accessToken: string, refreshToken: string) {
    this.setAccessTokenCookie(res, accessToken);
    this.setRefreshTokenCookie(res, refreshToken);
  }

  private setAccessTokenCookie(res: Response, accessToken: string) {
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api',
      maxAge: 24 * 60 * 60 * 1000,
    });
  }

  private setRefreshTokenCookie(res: Response, refreshToken: string) {
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private clearTokenCookies(res: Response) {
    res.clearCookie('access_token', { path: '/api' });
    res.clearCookie('refresh_token', { path: '/api/auth' });
  }
}
