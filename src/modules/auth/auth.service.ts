import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { User } from '../../entities/user.entity';
import { RefreshToken } from '../../entities/refresh-token.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.userRepository.findOne({ where: { username: dto.username } });
    if (existing) throw new ConflictException('Username already taken');

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = this.userRepository.create({
      username: dto.username,
      password: hashedPassword,
      name: dto.name,
      role: dto.role,
    });
    await this.userRepository.save(user);

    const tokens = await this.generateTokens(user);
    return { ...tokens, user: this.sanitizeUser(user) };
  }

  async login(dto: LoginDto) {
    const user = await this.userRepository.findOne({ where: { username: dto.username } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.generateTokens(user);
    return { ...tokens, user: this.sanitizeUser(user) };
  }

  async refresh(refreshTokenStr: string) {
    const stored = await this.refreshTokenRepository.findOne({
      where: { token: refreshTokenStr },
      relations: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      if (stored) await this.refreshTokenRepository.remove(stored);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = stored.user;
    const accessToken = await this.generateAccessToken(user);

    return { accessToken, user: this.sanitizeUser(user) };
  }

  async logout(refreshTokenStr: string) {
    await this.refreshTokenRepository.delete({ token: refreshTokenStr });
  }

  private async generateTokens(user: User) {
    const accessToken = await this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user);
    return { accessToken, refreshToken };
  }

  private async generateAccessToken(user: User) {
    const payload = { sub: user.id, username: user.username, role: user.role, hospitalId: user.hospitalId };
    return this.jwtService.sign(payload);
  }

  private async generateRefreshToken(user: User) {
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.refreshTokenRepository.save({
      userId: user.id,
      token,
      expiresAt,
    });

    return token;
  }

  private sanitizeUser(user: User) {
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      hospitalId: user.hospitalId,
    };
  }
}
