import { IsString, IsUUID, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAmbulanceDto {
  @ApiProperty({ example: 'ABC-1234' })
  @IsString()
  @MinLength(4)
  plate: string;

  @ApiProperty({ example: 'Mercedes Sprinter 2024', required: false })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiProperty({ example: 'uuid-del-hospital' })
  @IsUUID()
  hospitalId: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  platePhoto?: string;
}
