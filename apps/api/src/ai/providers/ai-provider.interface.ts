/**
 * Unified AI provider interface (doc 5.10, MVP subset): every provider —
 * Anthropic today, others later — sits behind this contract. The model used
 * by each agent comes from AgentDefinition.modelConfig, never from code.
 */

export interface AiCompletionRequest {
  model: string;
  system: string;
  userMessage: string;
  maxTokens: number;
  /** When set, providers that support structured outputs constrain the response to this JSON Schema */
  responseSchema?: object;
  /** Passed through to providers that need context (MockProvider derives deterministic output from it) */
  metadata?: { agentKey?: string; payload?: unknown };
}

export interface AiCompletionResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface AiProvider {
  readonly name: string;
  complete(request: AiCompletionRequest): Promise<AiCompletionResponse>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');
