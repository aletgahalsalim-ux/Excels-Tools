import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { FilesController } from './files.controller';
import { PipelineService } from './pipeline.service';

@Module({
  imports: [AiModule],
  controllers: [FilesController],
  providers: [PipelineService],
  exports: [PipelineService],
})
export class FilesModule {}
