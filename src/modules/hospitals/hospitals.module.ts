import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HospitalsController } from './hospitals.controller';
import { HospitalsService } from './hospitals.service';
import { Hospital } from '../../entities/hospital.entity';
import { User } from '../../entities/user.entity';
import { Ambulance } from '../../entities/ambulance.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Hospital, User, Ambulance])],
  controllers: [HospitalsController],
  providers: [HospitalsService],
  exports: [HospitalsService],
})
export class HospitalsModule {}
