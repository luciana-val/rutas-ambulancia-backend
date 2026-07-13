import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SimulationController } from './simulation.controller';
import { SimulationService } from './simulation.service';
import { SimulationRoute } from '../../entities/simulation-route.entity';
import { AmbulancesModule } from '../ambulances/ambulances.module';
import { AlertsModule } from '../alerts/alerts.module';
import { HospitalsModule } from '../hospitals/hospitals.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SimulationRoute]),
    AmbulancesModule,
    AlertsModule,
    HospitalsModule,
  ],
  controllers: [SimulationController],
  providers: [SimulationService],
  exports: [SimulationService],
})
export class SimulationModule {}
