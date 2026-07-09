import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Audit Trail (doc phase 9): logins, uploads, generations, exports, deletes. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    userId: string | null,
    action: string,
    entity?: string,
    entityId?: string,
    detail?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: { userId, action, entity, entityId, detail: detail as Prisma.InputJsonValue },
    });
  }
}
