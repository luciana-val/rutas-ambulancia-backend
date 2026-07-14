import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import databaseConfig from './config/database.config';
import appConfig from './config/app.config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { HospitalsModule } from './modules/hospitals/hospitals.module';
import { AmbulancesModule } from './modules/ambulances/ambulances.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { SimulationModule } from './modules/simulation/simulation.module';
import { SeedModule } from './modules/seed/seed.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { User, RefreshToken, Hospital, Ambulance, Alert, SimulationRoute } from './entities';
import * as process from 'process';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, appConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const dbConfig = {
          type: 'postgres' as const,
          host: config.get('DB_HOST') || 'localhost',
          port: parseInt(config.get('DB_PORT') || '5432', 10),
          username: config.get('DB_USERNAME') || 'postgres',
          password: config.get('DB_PASSWORD') ?? 'postgres',
          database: config.get('DB_DATABASE') || 'ambulance_routing',
          entities: [User, RefreshToken, Hospital, Ambulance, Alert, SimulationRoute],
          synchronize: config.get('app.nodeEnv') !== 'production',
          logging: false,
        };
        return dbConfig;
      },
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
      exclude: ['/api*'],
    }),
    AuthModule,
    UsersModule,
    HospitalsModule,
    AmbulancesModule,
    AlertsModule,
    SimulationModule,
    SeedModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
