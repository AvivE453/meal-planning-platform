import { Module } from '@nestjs/common';
import { ProfileModule } from '../profile/profile.module';
import { LogsModule } from '../logs/logs.module';
import { RecipesModule } from '../recipes/recipes.module';
import { MealPlansController } from './meal-plans.controller';
import { MealPlansService } from './meal-plans.service';

@Module({
  imports: [ProfileModule, LogsModule, RecipesModule],
  controllers: [MealPlansController],
  providers: [MealPlansService],
})
export class MealPlansModule {}
