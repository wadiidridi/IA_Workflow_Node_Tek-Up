export interface AgentRequest {
  inputs: Record<string, unknown>;
  context: Record<string, unknown>;
}

export interface AgentResponse {
  status: 'success' | 'error';
  outputs: Record<string, unknown>;
  metrics: { durationMs: number };
  logs: string[];
  error?: string;
}

function simulateDelay(min = 200, max = 800): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min) + min);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function summarize(inputs: Record<string, unknown>): Promise<AgentResponse> {
  const start = Date.now();
  await simulateDelay(300, 1000);
  const text = (inputs.text as string) || '';
  const maxPoints = (inputs.max_points as number) || 3;
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const summary = sentences.slice(0, maxPoints).map((s) => s.trim());

  return {
    status: 'success',
    outputs: { summary: summary.length > 0 ? summary : ['No content to summarize.'] },
    metrics: { durationMs: Date.now() - start },
    logs: [`Summarized ${sentences.length} sentences into ${summary.length} points`],
  };
}

async function sentimentAnalysis(inputs: Record<string, unknown>): Promise<AgentResponse> {
  const start = Date.now();
  await simulateDelay(200, 600);
  const text = (inputs.text as string) || '';

  const positiveWords = ['good', 'great', 'excellent', 'happy', 'love', 'wonderful', 'amazing', 'fantastic', 'beautiful', 'best'];
  const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'horrible', 'ugly', 'poor', 'sad', 'angry'];

  const lower = text.toLowerCase();
  const posCount = positiveWords.filter((w) => lower.includes(w)).length;
  const negCount = negativeWords.filter((w) => lower.includes(w)).length;

  let label: string;
  let score: number;
  if (posCount > negCount) {
    label = 'positive';
    score = Math.min(0.5 + posCount * 0.1, 0.99);
  } else if (negCount > posCount) {
    label = 'negative';
    score = Math.min(0.5 + negCount * 0.1, 0.99);
  } else {
    label = 'neutral';
    score = 0.5;
  }

  return {
    status: 'success',
    outputs: { label, score: Math.round(score * 100) / 100 },
    metrics: { durationMs: Date.now() - start },
    logs: [`Sentiment analysis: ${label} (${score.toFixed(2)}), pos=${posCount}, neg=${negCount}`],
  };
}

async function translateText(inputs: Record<string, unknown>): Promise<AgentResponse> {
  const start = Date.now();
  await simulateDelay(300, 700);
  const text = (inputs.text as string) || '';
  const toLang = (inputs.toLang as string) || 'en';

  // Simple mock: prepend language tag
  const translated = toLang === 'en' ? text : `[${toLang.toUpperCase()}] ${text}` ;

  return {
    status: 'success',
    outputs: { translated },
    metrics: { durationMs: Date.now() - start },
    logs: [`Translated text to ${toLang} (${text.length} chars)`],
  };
}

const agentHandlers: Record<string, (inputs: Record<string, unknown>) => Promise<AgentResponse>> = {
  'internal://nlp.summarize': summarize,
  'internal://nlp.sentiment': sentimentAnalysis,
  'internal://utils.translate': translateText,
};

export async function executeAgent(endpointUrl: string, request: AgentRequest): Promise<AgentResponse> {
  const handler = agentHandlers[endpointUrl];
  if (handler) {
    return handler(request.inputs);
  }

  // External agent: supports GET (URL with {{placeholders}}) and POST
  const start = Date.now();
  try {
    let response: Response;

    if (endpointUrl.includes('{{')) {
      // GET mode: substitute {{key}} placeholders in URL with input values
      let resolvedUrl = endpointUrl;
      for (const [key, value] of Object.entries(request.inputs)) {
        resolvedUrl = resolvedUrl.replace(
          new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
          encodeURIComponent(String(value))
        );
      }
      response = await fetch(resolvedUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(30000),
      });
    } else {
      // POST mode: send inputs as JSON body
      response = await fetch(endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(30000),
      });
    }

    if (!response.ok) {
      return {
        status: 'error',
        outputs: {},
        metrics: { durationMs: Date.now() - start },
        logs: [`HTTP ${response.status}: ${response.statusText}`],
        error: `Agent returned status ${response.status}`,
      };
    }

    const data = await response.json() as Record<string, unknown>;

    // If response already follows our format, use it directly
    if (data.status && data.outputs) {
      return data as unknown as AgentResponse;
    }

    // Otherwise, wrap the raw API response as outputs
    return {
      status: 'success',
      outputs: data,
      metrics: { durationMs: Date.now() - start },
      logs: [`External API responded with ${Object.keys(data).length} fields`],
    };
  } catch (err) {
    console.error(`Error executing agent at ${endpointUrl}:`, err);
    return {
      status: 'error',
      outputs: {},
      metrics: { durationMs: Date.now() - start },
      logs: [`Error calling agent: ${(err as Error).message}`],
      error: (err as Error).message,
    };
  }
}
