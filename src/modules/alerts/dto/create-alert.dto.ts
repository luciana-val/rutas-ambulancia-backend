import { IsString, IsNumber, IsUUID, IsOptional, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAlertDto {
  @ApiProperty()
  @IsUUID()
  hospitalId: string;

  @ApiProperty()
  @IsNumber()
  latitude: number;

  @ApiProperty()
  @IsNumber()
  longitude: number;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  description: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  callerName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  callerPhone?: string;
}
