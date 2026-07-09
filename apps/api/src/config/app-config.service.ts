import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Configuration Management (doc 11.7): runtime-changeable settings are read
 * from the AppConfig table (with a short in-memory cache) — never hardcoded.
 */
@Injectable()
export class AppConfigService {
  private cache = new Map<string, { value: unknown; expires: number }>();
  private readonly ttlMs = 30_000;

  constructor(private readonly prisma: PrismaService) {}

  async get<T>(key: string, fallback: T): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.value as T;

    const row = await this.prisma.appConfig.findUnique({ where: { key } });
    const value = (row?.value as T) ?? fallback;
    this.cache.set(key, { value, expires: Date.now() + this.ttlMs });
    return value;
  }
}
