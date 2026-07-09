/**
 * Configuration Management seed (doc 11.7) — every runtime-changeable setting
 * lives here (and later in the admin panel), never as a code constant.
 */

export const APP_CONFIG: Record<string, unknown> = {
  maxFileSizeMb: 50,
  allowedExtensions: ['.xlsx', '.xlsm'],
  analyzerMaxRowsPerTable: 200,
  agentTimeoutMs: 120000,
  agentMaxRetries: 1,
  /** USD per million tokens, used by Agent Cost Observability (doc 5.3) */
  aiPricing: {
    'claude-sonnet-5': { inputPerMTok: 3, outputPerMTok: 15 },
    'claude-opus-4-8': { inputPerMTok: 15, outputPerMTok: 75 },
    'claude-haiku-4-5-20251001': { inputPerMTok: 1, outputPerMTok: 5 },
    mock: { inputPerMTok: 0, outputPerMTok: 0 },
  },
};
