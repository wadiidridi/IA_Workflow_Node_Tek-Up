import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Seed users
  const adminPassword = await bcrypt.hash('admin123', 10);
  const userPassword = await bcrypt.hash('user123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    update: {},
    create: {
      email: 'admin@test.com',
      password: adminPassword,
      role: Role.ADMIN,
    },
  });

  const user = await prisma.user.upsert({
    where: { email: 'user@test.com' },
    update: {},
    create: {
      email: 'user@test.com',
      password: userPassword,
      role: Role.USER,
    },
  });

  // Seed agents
  const summarize = await prisma.agent.upsert({
    where: { id: 'agent-nlp-summarize' },
    update: {},
    create: {
      id: 'agent-nlp-summarize',
      name: 'summarize',
      family: 'nlp',
      version: '1.0.0',
      endpointUrl: 'internal://nlp.summarize',
      schemaIn: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text to summarize' },
          max_points: { type: 'number', description: 'Max summary bullet points' },
          language: { type: 'string', description: 'Language code (en, fr, etc.)' },
        },
        required: ['text'],
      },
      schemaOut: {
        type: 'object',
        properties: {
          summary: { type: 'array', items: { type: 'string' } },
        },
      },
      tags: ['nlp', 'text', 'summarization'],
      active: true,
    },
  });

  const sentiment = await prisma.agent.upsert({
    where: { id: 'agent-nlp-sentiment' },
    update: {},
    create: {
      id: 'agent-nlp-sentiment',
      name: 'sentiment',
      family: 'nlp',
      version: '1.0.0',
      endpointUrl: 'internal://nlp.sentiment',
      schemaIn: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text to analyze' },
          language: { type: 'string', description: 'Language code' },
        },
        required: ['text'],
      },
      schemaOut: {
        type: 'object',
        properties: {
          label: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
          score: { type: 'number' },
        },
      },
      tags: ['nlp', 'sentiment', 'analysis'],
      active: true,
    },
  });

  const translate = await prisma.agent.upsert({
    where: { id: 'agent-utils-translate' },
    update: {},
    create: {
      id: 'agent-utils-translate',
      name: 'translate',
      family: 'utils',
      version: '1.0.0',
      endpointUrl: 'internal://utils.translate',
      schemaIn: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text to translate' },
          toLang: { type: 'string', description: 'Target language code' },
        },
        required: ['text', 'toLang'],
      },
      schemaOut: {
        type: 'object',
        properties: {
          translated: { type: 'string' },
        },
      },
      tags: ['utils', 'translation', 'language'],
      active: true,
    },
  });

  // Seed workflows
  await prisma.workflow.upsert({
    where: { id: 'workflow-linear' },
    update: {},
    create: {
      id: 'workflow-linear',
      name: 'Translate then Summarize',
      createdBy: admin.id,
      status: 'DRAFT',
      nodes: [
        {
          id: 'node-1',
          agentId: translate.id,
          label: 'Translate to English',
          position: { x: 100, y: 200 },
          config: {},
          mappingIn: { text: '{{prompt}}', toLang: 'en' },
          mappingOut: {},
          errorPolicy: 'STOP',
          maxRetries: 1,
          backoffMs: 1000,
        },
        {
          id: 'node-2',
          agentId: summarize.id,
          label: 'Summarize Text',
          position: { x: 500, y: 200 },
          config: {},
          mappingIn: { text: '{{node-1.translated}}', max_points: 3, language: 'en' },
          mappingOut: {},
          errorPolicy: 'STOP',
          maxRetries: 0,
          backoffMs: 1000,
        },
      ],
      edges: [
        {
          id: 'edge-1',
          source: 'node-1',
          target: 'node-2',
          sourceHandle: 'output',
          targetHandle: 'input',
        },
      ],
      variables: {},
    },
  });

  await prisma.workflow.upsert({
    where: { id: 'workflow-parallel' },
    update: {},
    create: {
      id: 'workflow-parallel',
      name: 'Translate then Analyze (Summary + Sentiment)',
      createdBy: admin.id,
      status: 'DRAFT',
      nodes: [
        {
          id: 'node-1',
          agentId: translate.id,
          label: 'Translate to English',
          position: { x: 100, y: 300 },
          config: {},
          mappingIn: { text: '{{prompt}}', toLang: 'en' },
          mappingOut: {},
          errorPolicy: 'STOP',
          maxRetries: 1,
          backoffMs: 1000,
        },
        {
          id: 'node-2',
          agentId: summarize.id,
          label: 'Summarize',
          position: { x: 500, y: 150 },
          config: {},
          mappingIn: { text: '{{node-1.translated}}', max_points: 5, language: 'en' },
          mappingOut: {},
          errorPolicy: 'CONTINUE',
          maxRetries: 0,
          backoffMs: 1000,
        },
        {
          id: 'node-3',
          agentId: sentiment.id,
          label: 'Sentiment Analysis',
          position: { x: 500, y: 450 },
          config: {},
          mappingIn: { text: '{{node-1.translated}}', language: 'en' },
          mappingOut: {},
          errorPolicy: 'CONTINUE',
          maxRetries: 2,
          backoffMs: 2000,
        },
      ],
      edges: [
        {
          id: 'edge-1',
          source: 'node-1',
          target: 'node-2',
          sourceHandle: 'output',
          targetHandle: 'input',
        },
        {
          id: 'edge-2',
          source: 'node-1',
          target: 'node-3',
          sourceHandle: 'output',
          targetHandle: 'input',
        },
      ],
      variables: {},
    },
  });

  console.log('Seed data created successfully');
  console.log('Users:', { admin: admin.email, user: user.email });
  console.log('Agents:', [summarize.name, sentiment.name, translate.name]);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
