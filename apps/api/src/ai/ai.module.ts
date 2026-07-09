import { Module } from '@nestjs/common';
import { AgentRunnerService } from './agent-runner.service';
import { AgentsOrchestratorService } from './agents-orchestrator.service';
import { OutputValidatorService } from './output-validator.service';
import { PlannerService } from './planner.service';
import { AI_PROVIDER } from './providers/ai-provider.interface';
import { AnthropicProvider } from './providers/anthropic.provider';
import { MockProvider } from './providers/mock.provider';

@Module({
  providers: [
    OutputValidatorService,
    PlannerService,
    AgentRunnerService,
    AgentsOrchestratorService,
    AnthropicProvider,
    MockProvider,
    {
      provide: AI_PROVIDER,
      inject: [AnthropicProvider, MockProvider],
      useFactory: (anthropic: AnthropicProvider, mock: MockProvider) =>
        (process.env.AI_PROVIDER ?? 'mock') === 'anthropic' ? anthropic : mock,
    },
  ],
  exports: [AgentsOrchestratorService, OutputValidatorService, PlannerService],
})
export class AiModule {}
