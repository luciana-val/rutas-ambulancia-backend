import { Injectable, ConflictException, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../../entities/user.entity';
import { CreateUserDto, UpdateUserDto, ChangePasswordDto } from './dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findAll(hospitalId?: string): Promise<User[]> {
    const where: any = {};
    if (hospitalId) where.hospitalId = hospitalId;
    return this.userRepository.find({ where, order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(dto: CreateUserDto, requesterHospitalId: string | null): Promise<User> {
    const existing = await this.userRepository.findOne({ where: { username: dto.username } });
    if (existing) throw new ConflictException('Username already taken');

    const effectiveHospitalId = dto.hospitalId ?? requesterHospitalId;

    if (requesterHospitalId && effectiveHospitalId !== requesterHospitalId) {
      throw new ForbiddenException('You can only create users in your hospital');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = this.userRepository.create({
      username: dto.username,
      password: hashedPassword,
      name: dto.name,
      role: dto.role,
      hospitalId: effectiveHospitalId ?? undefined,
    });
    return this.userRepository.save(user);
  }

  async update(id: string, dto: UpdateUserDto, requesterHospitalId: string | null): Promise<User> {
    const user = await this.findOne(id);

    if (requesterHospitalId && user.hospitalId !== requesterHospitalId) {
      throw new ForbiddenException('You can only update users in your hospital');
    }

    if (dto.username && dto.username !== user.username) {
      const existing = await this.userRepository.findOne({ where: { username: dto.username } });
      if (existing) throw new ConflictException('Username already taken');
      user.username = dto.username;
    }
    if (dto.name !== undefined) user.name = dto.name;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.hospitalId !== undefined) {
      if (requesterHospitalId !== null) {
        throw new ForbiddenException('Only super admin can change hospital assignment');
      }
      user.hospitalId = dto.hospitalId;
    }
    if (dto.password) {
      user.password = await bcrypt.hash(dto.password, 10);
    }

    return this.userRepository.save(user);
  }

  async remove(id: string, requesterHospitalId: string | null): Promise<void> {
    const user = await this.findOne(id);

    if (requesterHospitalId && user.hospitalId !== requesterHospitalId) {
      throw new ForbiddenException('You can only delete users in your hospital');
    }

    await this.userRepository.remove(user);
  }

  async changePassword(id: string, requesterId: string, requesterRole: string, dto: ChangePasswordDto): Promise<void> {
    const isOwn = id === requesterId;
    const isAdmin = requesterRole === 'admin';

    if (!isOwn && !isAdmin) {
      throw new BadRequestException('You can only change your own password');
    }

    const user = await this.findOne(id);

    if (isOwn) {
      const isCurrentPasswordValid = await bcrypt.compare(dto.currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw new BadRequestException('Current password is incorrect');
      }
    }

    user.password = await bcrypt.hash(dto.newPassword, 10);
    await this.userRepository.save(user);
  }
}
