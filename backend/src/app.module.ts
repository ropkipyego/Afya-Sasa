import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreModule } from './core/core.module';
import { PatientsModule } from './patients/patients.module';
import { NotificationsModule } from './notifications/notifications.module';
import { HealthModule } from './health/health.module';
import { OpdModule } from './opd/opd.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { InpatientModule } from './inpatient/inpatient.module';
import { EmergencyModule } from './emergency/emergency.module';
import { NursingModule } from './nursing/nursing.module';
import { ReportingModule } from './reporting/reporting.module';
import { TheatreModule } from './theatre/theatre.module';
import { MaternityModule } from './maternity/maternity.module';
import { IcuModule } from './icu/icu.module';
import { HduModule } from './hdu/hdu.module';
import { LaboratoryModule } from './laboratory/laboratory.module';
import { RadiologyModule } from './radiology/radiology.module';
import { StorageModule } from './storage/storage.module';
import { ReferralsModule } from './referrals/referrals.module';
import { TenantMiddleware } from './core/tenancy/tenant.middleware';
import { JwtAccessGuard, PermissionsGuard } from './core/auth/auth.guards';
import { AuditInterceptor } from './core/audit/audit.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('POSTGRES_HOST', 'localhost'),
        port: config.get<number>('POSTGRES_PORT', 5432),
        username: config.get<string>('POSTGRES_USER', 'afyasasa'),
        password: config.get<string>('POSTGRES_PASSWORD', 'afyasasa'),
        database: config.get<string>('POSTGRES_DB', 'afyasasa'),
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: config.get<string>('TYPEORM_MIGRATIONS_RUN', 'true') === 'true',
        migrations: [`${__dirname}/database/migrations/*{.ts,.js}`],
      }),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    CoreModule,
    PatientsModule,
    NotificationsModule,
    OpdModule,
    AppointmentsModule,
    InpatientModule,
    EmergencyModule,
    NursingModule,
    ReportingModule,
    TheatreModule,
    MaternityModule,
    IcuModule,
    HduModule,
    LaboratoryModule,
    RadiologyModule,
    StorageModule,
    ReferralsModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAccessGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
