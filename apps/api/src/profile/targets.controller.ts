import { Controller, Get, UseGuards } from '@nestjs/common';
import type {
  AuthenticatedUser,
  NutritionTargets,
} from '@meal-planning/shared-types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TargetsService } from './targets.service';

@Controller('users/me/targets')
@UseGuards(JwtAuthGuard)
export class TargetsController {
  constructor(private readonly targetsService: TargetsService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser): Promise<NutritionTargets> {
    return this.targetsService.getTargets(user.id);
  }
}
