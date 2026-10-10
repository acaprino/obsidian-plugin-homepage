export type TranscriptionProvider = 'whisper' | 'gemini';

/**
 * Models offered per provider (October 2026). OpenAI recommends gpt-transcribe
 * and retires the other three on 2027-02-26; Google shut the Gemini 2.0 models
 * down on 2026-06-01 (M15). Any other id can be typed as a custom model.
 */
export const PROVIDER_MODELS: Record<TranscriptionProvider, Record<string, string>> = {
  whisper: {
    'gpt-transcribe': 'GPT Transcribe',
    'whisper-1': 'Whisper 1 (retires Feb 2027)',
    'gpt-4o-transcribe': 'GPT-4o Transcribe (retires Feb 2027)',
    'gpt-4o-mini-transcribe': 'GPT-4o Mini Transcribe (retires Feb 2027)',
  },
  gemini: {
    'gemini-3.8-flash': 'Gemini 3.8 Flash',
    'gemini-3.5-flash-lite': 'Gemini 3.5 Flash-Lite',
  },
};

export const DEFAULT_MODELS: Record<TranscriptionProvider, string> = {
  whisper: 'gpt-transcribe',
  gemini: 'gemini-3.8-flash',
};

/** Models the provider no longer serves: a stored one falls back to the default. */
const RETIRED_MODELS = new Set(['gemini-2.0-flash', 'gemini-2.0-flash-001', 'gemini-2.0-flash-lite', 'gemini-2.0-flash-lite-001']);

/** The model a request uses: the configured one, or the default when it is empty or retired. */
export function effectiveModel(provider: TranscriptionProvider, model: string | undefined): string {
  return model && !RETIRED_MODELS.has(model) ? model : DEFAULT_MODELS[provider];
}

/**
 * Largest recording sent to each provider, kept below its limit: OpenAI takes
 * uploads up to 25 MB; Gemini takes a 20 MB inline request, and base64 grows
 * the audio by 4/3. Recording stops when it reaches this size (M19).
 */
export const PROVIDER_MAX_BYTES: Record<TranscriptionProvider, number> = {
  whisper: 24 * 1024 * 1024,
  gemini: 14 * 1024 * 1024,
};

interface GeminiResponseLike {
  promptFeedback?: { blockReason?: string };
  candidates?: { finishReason?: string }[];
}

/** Why a Gemini answer holds no text, in words the Notice can show (M63). */
export function geminiEmptyReason(json: unknown): string {
  const r = (json ?? {}) as GeminiResponseLike;
  const blocked = r.promptFeedback?.blockReason;
  if (blocked) return `blocked: ${blocked}`;
  const finish = r.candidates?.[0]?.finishReason;
  if (finish && finish !== 'STOP') return `stopped: ${finish}`;
  return 'no speech recognised';
}
