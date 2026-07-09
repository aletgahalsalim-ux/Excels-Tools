/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AGENTS } from './seed-data/agents';
import { PROMPTS } from './seed-data/prompts';
import { RULES } from './seed-data/rules';
import { APP_CONFIG } from './seed-data/config';

const prisma = new PrismaClient();

const ROLES: Array<{ key: string; name: string; nameAr: string; actions: string[] }> = [
  {
    key: 'admin',
    name: 'Administrator',
    nameAr: 'مدير النظام',
    actions: [
      'org:manage',
      'user:manage',
      'project:create',
      'project:read',
      'file:upload',
      'file:read',
      'document:generate',
      'document:read',
      'config:write',
      'rules:write',
      'audit:read',
    ],
  },
  {
    key: 'manager',
    name: 'Manager',
    nameAr: 'مدير',
    actions: [
      'project:create',
      'project:read',
      'file:upload',
      'file:read',
      'document:generate',
      'document:read',
      'audit:read',
    ],
  },
  {
    key: 'analyst',
    name: 'Financial Analyst',
    nameAr: 'محلل مالي',
    actions: [
      'project:create',
      'project:read',
      'file:upload',
      'file:read',
      'document:generate',
      'document:read',
    ],
  },
  {
    key: 'viewer',
    name: 'Viewer',
    nameAr: 'مُطّلع',
    actions: ['project:read', 'file:read', 'document:read'],
  },
];

async function main(): Promise<void> {
  // Roles + permissions
  for (const r of ROLES) {
    const role = await prisma.role.upsert({
      where: { key: r.key },
      update: { name: r.name, nameAr: r.nameAr },
      create: { key: r.key, name: r.name, nameAr: r.nameAr },
    });
    for (const action of r.actions) {
      await prisma.permission.upsert({
        where: { roleId_action: { roleId: role.id, action } },
        update: {},
        create: { roleId: role.id, action },
      });
    }
  }

  // Demo organization + admin user
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { key: 'admin' } });
  let org = await prisma.organization.findFirst({ where: { name: 'Demo Organization' } });
  if (!org) {
    org = await prisma.organization.create({ data: { name: 'Demo Organization' } });
  }
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@demo.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'admin1234';
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'Demo Admin',
      passwordHash: await bcrypt.hash(adminPassword, 10),
      organizationId: org.id,
      roleId: adminRole.id,
    },
  });

  // Agent Registry (all 12; only MVP agents active)
  for (const a of AGENTS) {
    await prisma.agentDefinition.upsert({
      where: { key: a.key },
      update: {
        name: a.name,
        description: a.description,
        scopeTag: a.scopeTag,
        active: a.active,
        dependencies: a.dependencies,
        capabilities: a.capabilities,
        modelConfig: a.modelConfig,
      },
      create: a,
    });
  }

  // Prompt templates (versioned, active v1)
  for (const p of PROMPTS) {
    const agent = await prisma.agentDefinition.findUniqueOrThrow({ where: { key: p.agentKey } });
    await prisma.promptTemplate.upsert({
      where: { agentId_version: { agentId: agent.id, version: p.version } },
      update: {
        systemPrompt: p.systemPrompt,
        responseSchema: p.responseSchema,
        isActive: p.isActive,
      },
      create: {
        agentId: agent.id,
        version: p.version,
        systemPrompt: p.systemPrompt,
        responseSchema: p.responseSchema,
        isActive: p.isActive,
      },
    });
  }

  // Rules Engine
  for (const r of RULES) {
    await prisma.rule.upsert({
      where: { ruleKey: r.ruleKey },
      update: {
        name: r.name,
        nameAr: r.nameAr,
        ruleType: r.ruleType,
        definition: r.definition,
        severity: r.severity,
        active: true,
      },
      create: r,
    });
  }

  // App configuration (runtime-changeable settings)
  for (const [key, value] of Object.entries(APP_CONFIG)) {
    await prisma.appConfig.upsert({
      where: { key },
      update: { value: value as object },
      create: { key, value: value as object },
    });
  }

  console.log('Seed completed: roles, demo admin, 12-agent registry, prompts, rules, config.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
