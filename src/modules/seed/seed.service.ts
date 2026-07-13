import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../../entities/user.entity';
import { UserRole } from '../../shared/interfaces';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async onApplicationBootstrap() {
    const username = process.env.SUPER_ADMIN_USERNAME;
    if (!username) return;

    const existing = await this.userRepository.findOne({
      where: { username, hospitalId: IsNull() },
    });

    if (existing) return;

    const password = process.env.SUPER_ADMIN_PASSWORD;
    const name = process.env.SUPER_ADMIN_NAME || 'Super Administrador';
    if (!password) {
      throw new Error('SUPER_ADMIN_PASSWORD environment variable is required but not set');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = this.userRepository.create({
      username,
      password: hashedPassword,
      name,
      role: UserRole.ADMIN,
      hospitalId: null,
    });
    await this.userRepository.save(user);

    console.log(`Super admin "${username}" created successfully`);
  }
}
