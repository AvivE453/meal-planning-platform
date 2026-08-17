import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { FoodItem, NutrientBreakdown } from '@meal-planning/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetNutrientsQueryDto } from './dto/get-nutrients-query.dto';
import { NutritionService } from './nutrition.service';

@Controller('foods')
@UseGuards(JwtAuthGuard)
export class NutritionController {
  constructor(private readonly nutritionService: NutritionService) {}

  @Get('search')
  search(@Query('q') query?: string): Promise<FoodItem[]> {
    if (!query || query.trim().length === 0) {
      throw new BadRequestException('Query parameter "q" is required');
    }
    return this.nutritionService.search(query);
  }

  @Get(':id/nutrients')
  getNutrients(
    @Param('id') id: string,
    @Query() query: GetNutrientsQueryDto,
  ): Promise<NutrientBreakdown> {
    return this.nutritionService.getNutrients(
      id,
      query.measureUri,
      query.quantity ?? 1,
    );
  }
}
