import { IsString, IsEnum, IsOptional, MinLength, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../../shared/interfaces';

export class UpdateUserDto {
  @ApiProperty({ example: 'admin', required: false })
  @IsString()
  @MinLength(3)
  @IsOptional()
  username?: string;

  @ApiProperty({ example: 'Admin User', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ enum: UserRole, required: false })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  hospitalId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @MinLength(6)
  @IsOptional()
  password?: string;
}
