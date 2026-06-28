import { GoogleGenAI } from "@google/genai";

const DEFAULT_MODEL = 'gemini-2.0-flash';
const DEFAULT_RATE_LIMIT = 20;
const WINDOW_MS = 60 * 1000;
const DEFAULT_MAX_BODY_BYTES = 10 * 1024 * 1024;

const ALLOWED_MODELS = new Set([
  'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash-exp',
  'gemini-2.0-flash-preview-image-generation',
  'gemini-2.5-flash-preview-tts',
  'gemini-2.5-flash-native-audio-preview-12-2025',
]);

const ALLOWED_CONFIG_KEYS = new Set([
  'systemInstruction',
  'thinkingConfig',
  'tools',
  'toolConfig',
  'responseMimeType',
  'responseSchema',
  'responseModalities',
  'speechConfig',
  'imageConfig',
]);

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

interface GeminiRequestBody {
  model?: string;
  contents: unknown;
  config?: unknown;
}

function getHeader(req: any, name: string): string | undefined {
  const val = req.headers?.[name];
  return Array.isArray(val) ? val[0] : val;
}

function getClientId(req: any): string {
  return (
    getHeader(req, 'x-forwarded-for')?.split(',')[0]?.trim() ||
    getHeader(req, 'x-real-ip') ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

function isAllowedOrigin(req: any): boolean {
  const origin = getHeader(req, 'origin') || '';
  if (!origin) return true;

  const allowed = new Set(
    (process.env.APP_ORIGINS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );

  const requestHost = getHeader(req, 'x-forwarded-host') || getHeader(req, 'host');
  if (requestHost) {
    allowed.add(`https://${requestHost}`);
    if (requestHost.startsWith('localhost') || requestHost.startsWith('127.0.0.1')) {
      allowed.add(`http://${requestHost}`);
    }
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    allowed.add(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }

  return allowed.has(origin);
}

function isRateLimited(clientId: string): boolean {
  const limit = Number(process.env.GEMINI_RATE_LIMIT_PER_MINUTE || DEFAULT_RATE_LIMIT);
  const now = Date.now();
  const current = rateLimitStore.get(clientId);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(clientId, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  current.count += 1;
  return current.count > limit;
}

function requestSize(body: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(body ?? {}), 'utf8');
  } catch {
    return DEFAULT_MAX_BODY_BYTES + 1;
  }
}

function sanitizeConfig(config: unknown): Record<string, unknown> | undefined {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return undefined;

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config as Record<string, unknown>)) {
    if (ALLOWED_CONFIG_KEYS.has(key)) {
      clean[key] = value;
    }
  }

  const thinkingConfig = clean.thinkingConfig as { thinkingBudget?: unknown } | undefined;
  if (thinkingConfig && typeof thinkingConfig === 'object') {
    const budget = Number(thinkingConfig.thinkingBudget || 0);
    clean.thinkingConfig = {
      ...thinkingConfig,
      thinkingBudget: Math.max(0, Math.min(32768, Number.isFinite(budget) ? budget : 0)),
    };
  }

  return Object.keys(clean).length > 0 ? clean : undefined;
}

function safeErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('API_KEY_INVALID') || message.includes('API key not valid')) {
    return 'API_KEY_INVALID';
  }
  if (message.includes('PERMISSION_DENIED') || message.includes('403')) {
    return 'PERMISSION_DENIED';
  }
  if (message.includes('429') || message.toLowerCase().includes('quota')) {
    return 'GEMINI_QUOTA_OR_RATE_LIMIT';
  }
  return 'GEMINI_REQUEST_FAILED';
}

export default async function handler(req: any, res: any) {
  res.setHeader?.('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: 'ORIGIN_NOT_ALLOWED' });
  }

  const clientId = getClientId(req);
  if (isRateLimited(clientId)) {
    return res.status(429).json({ error: 'RATE_LIMITED' });
  }

  const maxBytes = Number(process.env.GEMINI_MAX_REQUEST_BYTES || DEFAULT_MAX_BODY_BYTES);
  if (requestSize(req.body) > maxBytes) {
    return res.status(413).json({ error: 'REQUEST_TOO_LARGE' });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
  if (!apiKey) {
    return res.status(500).json({ error: 'MISSING_API_KEY' });
  }

  const body = (req.body || {}) as GeminiRequestBody;
  const model = body.model || DEFAULT_MODEL;
  if (!ALLOWED_MODELS.has(model)) {
    return res.status(400).json({ error: 'MODEL_NOT_ALLOWED' });
  }

  if (!body.contents) {
    return res.status(400).json({ error: 'MISSING_CONTENTS' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const config = sanitizeConfig(body.config);
    const result = await ai.models.generateContent({
      model,
      contents: body.contents as any,
      ...(config ? { config } : {}),
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('Gemini server request failed:', error);
    return res.status(502).json({ error: safeErrorCode(error) });
  }
}
