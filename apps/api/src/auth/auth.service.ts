import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { AuthResponseDto } from '@afdip/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  orgId: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: {
    email: string;
    password: string;
    name: string;
    organizationName: string;
  }): Promise<AuthResponseDto> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictException('Email already registered');

    // First user of a new organization is its admin.
    const adminRole = await this.prisma.role.findUniqueOrThrow({ where: { key: 'admin' } });
    const org = await this.prisma.organization.create({
      data: { name: input.organizationName },
    });
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: await bcrypt.hash(input.password, 10),
        organizationId: org.id,
        roleId: adminRole.id,
      },
      include: { role: true },
    });
    return this.issueToken(user.id, user.email, user.name, user.role.key, org.id);
  }

  async login(email: string, password: string): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });
    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issueToken(
      user.id,
      user.email,
      user.name,
      user.role.key,
      user.organizationId,
    );
  }

  issueToken(
    id: string,
    email: string,
    name: string,
    role: string,
    orgId: string,
  ): AuthResponseDto {
    const payload: JwtPayload = { sub: id, email, role, orgId };
    return {
      accessToken: this.jwt.sign(payload),
      user: { id, email, name, role },
    };
  }
}
