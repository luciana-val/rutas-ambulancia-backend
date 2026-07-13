import { IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateLocationDto {
  @ApiProperty({ example: -34.6037 })
  @IsNumber()
  latitude: number;

  @ApiProperty({ example: -58.3816 })
  @IsNumber()
  longitude: number;
}
