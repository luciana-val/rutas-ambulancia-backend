import { IsString, IsEnum, IsOptional, IsUUID, MinLength, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { AmbulanceStatus } from '../../../shared/interfaces';

export class UpdateAmbulanceDto {
  @ApiProperty({ required: false })
  @IsString()
  @MinLength(4)
  @IsOptional()
  plate?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiProperty({ enum: AmbulanceStatus, required: false })
  @IsEnum(AmbulanceStatus)
  @IsOptional()
  status?: AmbulanceStatus;

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  driverId?: string;

  @ApiProperty({ required: false })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  removeDriver?: boolean;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  platePhoto?: string;
}
