import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AI Workflow Builder API',
      version: '1.0.0',
      description: 'REST API for building and running AI agent workflows',
    },
    servers: [{ url: '/api', description: 'API server' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['ADMIN', 'USER'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Agent: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'summarize' },
            family: { type: 'string', example: 'nlp' },
            version: { type: 'string', example: '1.0.0' },
            schemaIn: { type: 'object', description: 'JSON Schema for agent input' },
            schemaOut: { type: 'object', description: 'JSON Schema for agent output' },
            endpointUrl: { type: 'string', example: 'internal://summarize' },
            tags: { type: 'array', items: { type: 'string' } },
            active: { type: 'boolean', default: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        AgentCreate: {
          type: 'object',
          required: ['name', 'family', 'version', 'schemaIn', 'schemaOut', 'endpointUrl'],
          properties: {
            name: { type: 'string' },
            family: { type: 'string' },
            version: { type: 'string' },
            schemaIn: { type: 'object' },
            schemaOut: { type: 'object' },
            endpointUrl: { type: 'string' },
            secrets: { type: 'object' },
            tags: { type: 'array', items: { type: 'string' } },
          },
        },
        WorkflowNode: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            agentId: { type: 'string', format: 'uuid' },
            label: { type: 'string' },
            position: {
              type: 'object',
              properties: { x: { type: 'number' }, y: { type: 'number' } },
            },
            config: { type: 'object' },
            mappingIn: { type: 'object' },
            mappingOut: { type: 'object' },
            errorPolicy: { type: 'string', enum: ['STOP', 'CONTINUE'] },
            maxRetries: { type: 'integer', default: 0 },
            backoffMs: { type: 'integer', default: 1000 },
          },
        },
        WorkflowEdge: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            source: { type: 'string' },
            target: { type: 'string' },
            sourceHandle: { type: 'string' },
            targetHandle: { type: 'string' },
          },
        },
        Workflow: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            nodes: { type: 'array', items: { $ref: '#/components/schemas/WorkflowNode' } },
            edges: { type: 'array', items: { $ref: '#/components/schemas/WorkflowEdge' } },
            variables: { type: 'object' },
            version: { type: 'integer' },
            status: { type: 'string', enum: ['DRAFT', 'RUNNING', 'SUCCESS', 'FAILED'] },
            createdBy: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        WorkflowCreate: {
          type: 'object',
          required: ['name', 'nodes', 'edges'],
          properties: {
            name: { type: 'string' },
            nodes: { type: 'array', items: { $ref: '#/components/schemas/WorkflowNode' } },
            edges: { type: 'array', items: { $ref: '#/components/schemas/WorkflowEdge' } },
            variables: { type: 'object' },
          },
        },
        RunStep: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            runId: { type: 'string', format: 'uuid' },
            nodeId: { type: 'string' },
            agentId: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED'] },
            durationMs: { type: 'integer', nullable: true },
            logs: { type: 'array', items: { type: 'string' } },
            inputPreview: { type: 'object', nullable: true },
            outputPreview: { type: 'object', nullable: true },
            errorPolicy: { type: 'string', enum: ['STOP', 'CONTINUE'] },
            maxRetries: { type: 'integer' },
            retryCount: { type: 'integer' },
          },
        },
        Run: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            workflowId: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['PENDING', 'RUNNING', 'SUCCESS', 'FAILED'] },
            prompt: { type: 'string' },
            startedAt: { type: 'string', format: 'date-time' },
            endedAt: { type: 'string', format: 'date-time', nullable: true },
            durationMs: { type: 'integer', nullable: true },
            metrics: { type: 'object', nullable: true },
            error: { type: 'string', nullable: true },
            triggeredBy: { type: 'string', format: 'uuid' },
            steps: { type: 'array', items: { $ref: '#/components/schemas/RunStep' } },
          },
        },
        RunCreate: {
          type: 'object',
          required: ['workflowId', 'prompt'],
          properties: {
            workflowId: { type: 'string', format: 'uuid' },
            prompt: { type: 'string', maxLength: 50000 },
          },
        },
        KpiData: {
          type: 'object',
          properties: {
            totalRuns: { type: 'integer' },
            successRate: { type: 'number' },
            avgDurationMs: { type: 'number' },
            p50DurationMs: { type: 'number' },
            p95DurationMs: { type: 'number' },
            maxDurationMs: { type: 'number' },
            errorsByFamily: { type: 'object' },
            topAgents: { type: 'array', items: { type: 'object' } },
            durationDistribution: { type: 'array', items: { type: 'object' } },
          },
        },
        ValidationResult: {
          type: 'object',
          properties: {
            valid: { type: 'boolean' },
            errors: { type: 'array', items: { type: 'string' } },
          },
        },
        Paginated: {
          type: 'object',
          properties: {
            data: { type: 'array', items: {} },
            total: { type: 'integer' },
            page: { type: 'integer' },
            limit: { type: 'integer' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts', './dist/routes/*.js'],
};

export const swaggerSpec = swaggerJsdoc(options);
