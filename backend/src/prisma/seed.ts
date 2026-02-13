import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

// Fixed UUIDs for reproducible seeds
const AGENT_SUMMARIZE_ID = '00000000-0000-4000-a000-000000000001';
const AGENT_SENTIMENT_ID = '00000000-0000-4000-a000-000000000002';
const AGENT_TRANSLATE_ID = '00000000-0000-4000-a000-000000000003';
const AGENT_GEOCODE_ID = '00000000-0000-4000-a000-000000000004';
const AGENT_FORECAST_ID = '00000000-0000-4000-a000-000000000005';
const WORKFLOW_LINEAR_ID = '00000000-0000-4000-b000-000000000001';
const WORKFLOW_PARALLEL_ID = '00000000-0000-4000-b000-000000000002';
const WORKFLOW_WEATHER_ID = '00000000-0000-4000-b000-000000000003';

async function main() {
  // Clean DB in correct order (respect foreign keys)
  await prisma.runStep.deleteMany();
  await prisma.run.deleteMany();
  await prisma.workflow.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.user.deleteMany();
  console.log('Database cleared');

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
    where: { id: AGENT_SUMMARIZE_ID },
    update: {},
    create: {
      id: AGENT_SUMMARIZE_ID,
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
    where: { id: AGENT_SENTIMENT_ID },
    update: {},
    create: {
      id: AGENT_SENTIMENT_ID,
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
    where: { id: AGENT_TRANSLATE_ID },
    update: {},
    create: {
      id: AGENT_TRANSLATE_ID,
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

  // External weather agents (real API calls, no API key needed)
  const geocode = await prisma.agent.upsert({
    where: { id: AGENT_GEOCODE_ID },
    update: {},
    create: {
      id: AGENT_GEOCODE_ID,
      name: 'geocode',
      family: 'weather',
      version: '1.0.0',
      endpointUrl: 'https://geocoding-api.open-meteo.com/v1/search?name={{city}}&count=1&language=en',
      schemaIn: {
        type: 'object',
        properties: {
          city: { type: 'string', description: 'City name (e.g. Paris, London, New York)' },
        },
        required: ['city'],
      },
      schemaOut: {
        type: 'object',
        properties: {
          results: { type: 'array', description: 'Array with latitude, longitude, name, country' },
        },
      },
      tags: ['weather', 'geocoding', 'external'],
      active: true,
    },
  });

  const forecast = await prisma.agent.upsert({
    where: { id: AGENT_FORECAST_ID },
    update: {},
    create: {
      id: AGENT_FORECAST_ID,
      name: 'forecast',
      family: 'weather',
      version: '1.0.0',
      endpointUrl: 'https://api.open-meteo.com/v1/forecast?latitude={{latitude}}&longitude={{longitude}}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code',
      schemaIn: {
        type: 'object',
        properties: {
          latitude: { type: 'string', description: 'Latitude coordinate' },
          longitude: { type: 'string', description: 'Longitude coordinate' },
        },
        required: ['latitude', 'longitude'],
      },
      schemaOut: {
        type: 'object',
        properties: {
          current: { type: 'object', description: 'Current weather data with temperature_2m, humidity, wind_speed, weather_code' },
          current_units: { type: 'object', description: 'Units for current weather fields' },
        },
      },
      tags: ['weather', 'forecast', 'external'],
      active: true,
    },
  });

  // Seed workflows
  await prisma.workflow.upsert({
    where: { id: WORKFLOW_LINEAR_ID },
    update: {},
    create: {
      id: WORKFLOW_LINEAR_ID,
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
    where: { id: WORKFLOW_PARALLEL_ID },
    update: {},
    create: {
      id: WORKFLOW_PARALLEL_ID,
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

  // Weather workflow: Geocode city → Get forecast
  await prisma.workflow.upsert({
    where: { id: WORKFLOW_WEATHER_ID },
    update: {},
    create: {
      id: WORKFLOW_WEATHER_ID,
      name: 'Get Weather by City (External API)',
      createdBy: admin.id,
      status: 'DRAFT',
      nodes: [
        {
          id: 'node-1',
          agentId: geocode.id,
          label: 'Geocode City',
          position: { x: 100, y: 250 },
          config: {},
          mappingIn: { city: '{{prompt}}' },
          mappingOut: {},
          errorPolicy: 'STOP',
          maxRetries: 1,
          backoffMs: 1000,
        },
        {
          id: 'node-2',
          agentId: forecast.id,
          label: 'Get Forecast',
          position: { x: 500, y: 250 },
          config: {},
          mappingIn: { latitude: '{{node-1.results[0].latitude}}', longitude: '{{node-1.results[0].longitude}}' },
          mappingOut: {},
          errorPolicy: 'STOP',
          maxRetries: 1,
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

  console.log('Seed data created successfully');
  console.log('Users:', { admin: admin.email, user: user.email });
  console.log('Agents:', [summarize.name, sentiment.name, translate.name, geocode.name, forecast.name]);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
