import { describe, it, expect } from 'vitest';
import { DEFAULT_MODELS, PROVIDER_MAX_BYTES, effectiveModel, geminiEmptyReason } from '../../src/utils/voiceProviders';

describe('effectiveModel (M15)', () => {
  it('uses the current default for an empty or retired model', () => {
    expect(effectiveModel('whisper', '')).toBe('gpt-transcribe');
    expect(effectiveModel('gemini', undefined)).toBe('gemini-3.8-flash');
    expect(effectiveModel('gemini', 'gemini-2.0-flash')).toBe('gemini-3.8-flash');
    expect(effectiveModel('gemini', 'gemini-2.0-flash-lite')).toBe('gemini-3.8-flash');
  });

  it('keeps a model the user picked or typed', () => {
    expect(effectiveModel('whisper', 'whisper-1')).toBe('whisper-1');
    expect(effectiveModel('gemini', 'gemini-9-ultra')).toBe('gemini-9-ultra');
  });

  it('names a default for each provider', () => {
    expect(DEFAULT_MODELS).toEqual({ whisper: 'gpt-transcribe', gemini: 'gemini-3.8-flash' });
  });
});

describe('provider limits (M19)', () => {
  it('stays below the OpenAI 25 MB upload limit and the Gemini 20 MB inline request', () => {
    expect(PROVIDER_MAX_BYTES.whisper).toBeLessThan(25 * 1024 * 1024);
    // base64 grows the audio by 4/3 inside a 20 MB request
    expect(PROVIDER_MAX_BYTES.gemini * 4 / 3).toBeLessThan(20 * 1024 * 1024);
  });
});

describe('geminiEmptyReason (M63)', () => {
  it('names a blocked prompt or an unusual finish', () => {
    expect(geminiEmptyReason({ promptFeedback: { blockReason: 'SAFETY' } })).toBe('blocked: SAFETY');
    expect(geminiEmptyReason({ candidates: [{ finishReason: 'RECITATION' }] })).toBe('stopped: RECITATION');
    expect(geminiEmptyReason({ candidates: [] })).toBe('no speech recognised');
  });
});
