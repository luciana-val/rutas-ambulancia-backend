import { IsString, IsEnum, IsOptional, MinLength } from 'class-validator';
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
}
