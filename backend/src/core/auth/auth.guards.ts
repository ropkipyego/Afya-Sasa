import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import {
  IS_PUBLIC_KEY,
  REQUIRED_PERMISSIONS_KEY,
} from './auth.decorators';
import type {
  AuthenticatedUserContext,
  RequestContext,
} from '../../common/request-context';
import { TokenRevocationService } from './token-revocation.service';

@Injectable()
export class JwtAccessGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly tokenRevocation: TokenRevocationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestContext>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      throw new UnauthorizedException('Missing bearer access token');
    }

    try {
      const payload = await this.jwtService.verifyAsync<AuthenticatedUserContext>(
        token,
      );
      if (
        payload.iat &&
        (await this.tokenRevocation.isAccessTokenRevoked(payload.sub, payload.iat))
      ) {
        throw new UnauthorizedException('Session expired — please sign in again');
      }
      request.user = payload;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestContext>();
    const userPermissions = new Set(request.user?.permissions ?? []);
    const allowed = required.every((permission) =>
      userPermissions.has(permission),
    );

    if (!allowed) {
      throw new ForbiddenException('Permission denied');
    }

    return true;
  }
}
