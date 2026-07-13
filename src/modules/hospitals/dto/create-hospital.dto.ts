import { IsString, IsNumber, IsOptional, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateHospitalDto {
  @ApiProperty({ example: 'Hospital Central' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'Av. Siempre Viva 123' })
  @IsString()
  address: string;

  @ApiProperty({ example: -34.6037 })
  @IsNumber()
  latitude: number;

  @ApiProperty({ example: -58.3816 })
  @IsNumber()
  longitude: number;

  @ApiProperty({ example: '+54 11 1234-5678', required: false })
  @IsString()
  @IsOptional()
  phone?: string;
}
