import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser, MealPlan } from '@meal-planning/shared-types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AddMealPlanItemDto } from './dto/add-meal-plan-item.dto';
import { GenerateMealPlanDto } from './dto/generate-meal-plan.dto';
import { MealPlansService } from './meal-plans.service';

@Controller('meal-plans')
@UseGuards(JwtAuthGuard)
export class MealPlansController {
  constructor(private readonly mealPlansService: MealPlansService) {}

  @Post('generate')
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateMealPlanDto,
  ): Promise<MealPlan> {
    return this.mealPlansService.generate(user.id, dto.date);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<MealPlan[]> {
    return this.mealPlansService.findAllByUserId(user.id);
  }

  @Post(':id/items')
  addItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddMealPlanItemDto,
  ): Promise<MealPlan> {
    return this.mealPlansService.addItem(user.id, id, dto);
  }
}
