import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import type { ProjectDto } from '@afdip/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RequireAction, AuthedRequest } from '../auth/jwt-auth.guard';

class CreateProjectDto {
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

@Controller('projects')
export class ProjectsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @RequireAction('project:create')
  async create(@Body() dto: CreateProjectDto, @Req() req: AuthedRequest): Promise<ProjectDto> {
    const project = await this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        organizationId: req.user.orgId,
      },
    });
    return this.toDto(project);
  }

  @Get()
  @RequireAction('project:read')
  async list(@Req() req: AuthedRequest): Promise<ProjectDto[]> {
    const projects = await this.prisma.project.findMany({
      where: { organizationId: req.user.orgId },
      orderBy: { createdAt: 'desc' },
    });
    return projects.map((p) => this.toDto(p));
  }

  private toDto(p: {
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
  }): ProjectDto {
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      createdAt: p.createdAt.toISOString(),
    };
  }
}
