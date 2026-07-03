import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Encounter } from '../opd/opd.entities';
import { EncounterWorkflowService } from './encounter-workflow.service';

@Module({
  imports: [TypeOrmModule.forFeature([Encounter])],
  providers: [EncounterWorkflowService],
  exports: [EncounterWorkflowService],
})
export class WorkflowModule {}
