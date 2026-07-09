import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from './auth.service';

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const REQUIRED_ACTION = 'requiredAction';
/** Declares the RBAC permission action an endpoint requires, e.g. 'file:upload'. */
export const RequireAction = (action: string) => SetMetadata(REQUIRED_ACTION, action);

export interface AuthedRequest extends Request {
  user: JwtPayload;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private permissionCache = new Map<string, { actions: Set<string>; expires: number }>();

  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw new UnauthorizedException('Missing bearer token');

    try {
      request.user = this.jwt.verify<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const action = this.reflector.getAllAndOverride<string>(REQUIRED_ACTION, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (action) {
      const actions = await this.actionsForRole(request.user.role);
      if (!actions.has(action)) {
        throw new ForbiddenException(`Role '${request.user.role}' lacks permission '${action}'`);
      }
    }
    return true;
  }

  private async actionsForRole(roleKey: string): Promise<Set<string>> {
    const hit = this.permissionCache.get(roleKey);
    if (hit && hit.expires > Date.now()) return hit.actions;
    const role = await this.prisma.role.findUnique({
      where: { key: roleKey },
      include: { permissions: true },
    });
    const actions = new Set(role?.permissions.map((p) => p.action) ?? []);
    this.permissionCache.set(roleKey, { actions, expires: Date.now() + 60_000 });
    return actions;
  }
}
