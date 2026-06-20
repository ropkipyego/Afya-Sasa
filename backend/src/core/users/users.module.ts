import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolePermission, User, UserRole } from '../core.entities';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserRole, RolePermission])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
