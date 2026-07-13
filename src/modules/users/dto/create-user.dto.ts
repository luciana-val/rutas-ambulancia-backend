import { IsString, MinLength, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../../shared/interfaces';

export class CreateUserDto {
  @ApiProperty({ example: 'admin' })
  @IsString()
  @MinLength(3)
  username: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'Admin User' })
  @IsString()
  name: string;

  @ApiProperty({ enum: UserRole, default: UserRole.DISPATCHER })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiProperty({ example: 'uuid-del-hospital', required: false })
  @IsUUID()
  @IsOptional()
  hospitalId?: string;
}
