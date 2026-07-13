import { IsString, IsEnum, IsUUID, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AlertStatus } from '../../../shared/interfaces';

export class UpdateAlertDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: AlertStatus, required: false })
  @IsEnum(AlertStatus)
  @IsOptional()
  status?: AlertStatus;

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  ambulanceId?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isSimulation?: boolean;
}
