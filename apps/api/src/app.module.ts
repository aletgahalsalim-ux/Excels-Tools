import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AppConfigModule } from './config/app-config.module';
import { AuditModule } from './audit/audit.module';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { FilesModule } from './files/files.module';
import { DocumentsModule } from './documents/documents.module';

@Module({
  imports: [
    PrismaModule,
    AppConfigModule,
    AuditModule,
    StorageModule,
    AuthModule,
    ProjectsModule,
    FilesModule,
    DocumentsModule,
  ],
})
export class AppModule {}
