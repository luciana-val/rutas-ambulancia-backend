import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AmbulancesController } from './ambulances.controller';
import { AmbulancesService } from './ambulances.service';
import { Ambulance } from '../../entities/ambulance.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Ambulance])],
  controllers: [AmbulancesController],
  providers: [AmbulancesService],
  exports: [AmbulancesService],
})
export class AmbulancesModule {}
