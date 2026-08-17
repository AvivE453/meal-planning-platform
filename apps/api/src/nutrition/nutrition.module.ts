import { Module } from '@nestjs/common';
import { NutritionController } from './nutrition.controller';
import { NutritionService } from './nutrition.service';
import { EdamamApiClient } from './clients/edamam-api-client';
import { CachedNutritionApiClient } from './clients/cached-nutrition-api-client';
import { NUTRITION_API_CLIENT } from './clients/nutrition-api-client.interface';
import { EdamamFoodAdapter } from './adapters/edamam-food-adapter';

@Module({
  controllers: [NutritionController],
  providers: [
    EdamamApiClient,
    CachedNutritionApiClient,
    EdamamFoodAdapter,
    NutritionService,
    // The rest of the app depends on the NUTRITION_API_CLIENT token, never on
    // CachedNutritionApiClient directly — swapping the Proxy back out for the
    // real client (or a fake, in tests) is a one-line change here.
    { provide: NUTRITION_API_CLIENT, useExisting: CachedNutritionApiClient },
  ],
  exports: [NutritionService],
})
export class NutritionModule {}
