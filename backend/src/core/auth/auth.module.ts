import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoginEvent, PasswordResetToken, RefreshToken, User } from '../core.entities';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginAuditService } from './login-audit.service';
import { MfaService } from './mfa.service';
import { accessTokenTtlSeconds } from './session-policy';
import { TokenRevocationService } from './token-revocation.service';

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    MailModule,
    TenancyModule,
    TypeOrmModule.forFeature([RefreshToken, User, LoginEvent, PasswordResetToken]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: accessTokenTtlSeconds() },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LoginAuditService, TokenRevocationService, MfaService],
  exports: [AuthService, JwtModule, LoginAuditService, TokenRevocationService, MfaService],
})
export class AuthModule {}
