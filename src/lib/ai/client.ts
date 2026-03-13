// ---------------------------------------------------------------------------
// OpenAI Client — Singleton wrapper for OpenAI SDK
// ---------------------------------------------------------------------------

import OpenAI from "openai";

let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

/** Reset the cached client (for testing). */
export function resetOpenAIClient(): void {
  _client = null;
}
