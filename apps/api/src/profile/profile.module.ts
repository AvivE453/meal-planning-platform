import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { TargetsController } from './targets.controller';
import { TargetsService } from './targets.service';
import { RecalculateTargetsListener } from './events/recalculate-targets.listener';
import { RestrictionsController } from '../restrictions/restrictions.controller';
import { RestrictionsService } from '../restrictions/restrictions.service';
import { LogsModule } from '../logs/logs.module';

@Module({
  imports: [LogsModule],
  controllers: [ProfileController, RestrictionsController, TargetsController],
  providers: [
    ProfileService,
    RestrictionsService,
    TargetsService,
    RecalculateTargetsListener,
  ],
  exports: [ProfileService, RestrictionsService],
})
export class ProfileModule {}
