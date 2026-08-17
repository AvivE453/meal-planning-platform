import { Module } from '@nestjs/common';
import { WeightLogsController } from './weight-logs.controller';
import { WeightLogsService } from './weight-logs.service';
import { ActivityLogsController } from './activity-logs.controller';
import { ActivityLogsService } from './activity-logs.service';
import { NutritionLogsController } from './nutrition-logs.controller';
import { NutritionLogsService } from './nutrition-logs.service';

@Module({
  controllers: [
    WeightLogsController,
    ActivityLogsController,
    NutritionLogsController,
  ],
  providers: [WeightLogsService, ActivityLogsService, NutritionLogsService],
  exports: [WeightLogsService],
})
export class LogsModule {}
