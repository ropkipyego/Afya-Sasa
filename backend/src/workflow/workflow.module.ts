import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LabRequest, LabResult } from '../laboratory/laboratory.entities';
import { Encounter } from '../opd/opd.entities';
import { RadiologyReport, RadiologyRequest } from '../radiology/radiology.entities';
import { EncounterWorkflowService } from './encounter-workflow.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Encounter,
      LabRequest,
      LabResult,
      RadiologyRequest,
      RadiologyReport,
    ]),
  ],
  providers: [EncounterWorkflowService],
  exports: [EncounterWorkflowService],
})
export class WorkflowModule {}
