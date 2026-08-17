import { Module } from '@nestjs/common';
import { ProfileModule } from '../profile/profile.module';
import { LogsModule } from '../logs/logs.module';
import { NutritionModule } from '../nutrition/nutrition.module';
import { MealPlansController } from './meal-plans.controller';
import { MealPlansService } from './meal-plans.service';

@Module({
  imports: [ProfileModule, LogsModule, NutritionModule],
  controllers: [MealPlansController],
  providers: [MealPlansService],
})
export class MealPlansModule {}
