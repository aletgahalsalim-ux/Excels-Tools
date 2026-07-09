import Anthropic from '@anthropic-ai/sdk';
import { Injectable } from '@nestjs/common';
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
    const response = await this.getClient().messages.create({
      model: request.model,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      system: request.system,
      messages: [{ role: 'user', content: request.userMessage }],
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
