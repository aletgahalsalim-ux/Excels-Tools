import Anthropic from '@anthropic-ai/sdk';
import { Injectable } from '@nestjs/common';

/**
 * Prepares a stored JSON Schema for structured outputs:
 * 1. Strips constraints the API rejects (minimum, maximum, minItems, ...) —
 *    ajv still enforces the full schema afterwards in the Output Validator.
 * 2. Restores a reasoning-friendly property ORDER. Postgres JSONB sorts object
 *    keys alphabetically, and constrained decoding generates fields in schema
 *    order — which forced the model to write `message` before it had worked
 *    out `ruleKey`/`evidence`, producing empty/placeholder content. The
 *    `required` array (arrays keep their order in JSONB) carries the intended
 *    generation order, so properties are rebuilt to follow it.
 */
const UNSUPPORTED_KEYS = new Set(['minimum', 'maximum', 'minItems', 'maxItems', 'minLength', 'maxLength', 'multipleOf']);

export function sanitizeForStructuredOutput(schema: object): Record<string, unknown> {
  const visit = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(visit);
    if (node && typeof node === 'object') {
      const source = node as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(source)) {
        if (UNSUPPORTED_KEYS.has(key)) continue;
        out[key] = key === 'properties' ? reorderProperties(value, source.required) : visit(value);
      }
      return out;
    }
    return node;
  };

  const reorderProperties = (properties: unknown, required: unknown): unknown => {
    if (!properties || typeof properties !== 'object') return visit(properties);
    const props = properties as Record<string, unknown>;
    const order = Array.isArray(required) ? (required as string[]) : [];
    const ordered: Record<string, unknown> = {};
    for (const key of order) {
      if (key in props) ordered[key] = visit(props[key]);
    }
    for (const [key, value] of Object.entries(props)) {
      if (!(key in ordered)) ordered[key] = visit(value);
    }
    return ordered;
  };

  return visit(schema) as Record<string, unknown>;
}
import {
  AiCompletionRequest,
  AiCompletionResponse,
  AiProvider,
} from './ai-provider.interface';

@Injectable()
export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';
  private client: Anthropic | null = null;

  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error(
          'ANTHROPIC_API_KEY is not set — set it or switch AI_PROVIDER=mock for deterministic runs',
        );
      }
      this.client = new Anthropic({ apiKey });
    }
    return this.client;
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    // temperature/top_p/top_k are removed on claude-sonnet-5 / opus-4.7+ (400 if sent).
    // Structured outputs (output_config.format) constrain the response to the prompt's
    // JSON Schema at generation time; the Output Validator still fully re-validates.
    const response = await this.getClient().messages.create({
      model: request.model,
      max_tokens: request.maxTokens,
      system: request.system,
      messages: [{ role: 'user', content: request.userMessage }],
      ...(request.responseSchema
        ? {
            output_config: {
              format: {
                type: 'json_schema' as const,
                schema: sanitizeForStructuredOutput(request.responseSchema),
              },
            },
          }
        : {}),
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    return {
      text,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }
}
