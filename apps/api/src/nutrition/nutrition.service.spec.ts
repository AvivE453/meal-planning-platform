import { Test } from '@nestjs/testing';
import { NutritionService } from './nutrition.service';
import { PrismaService } from '../prisma/prisma.service';
import { EdamamFoodAdapter } from './adapters/edamam-food-adapter';
import { NUTRITION_API_CLIENT } from './clients/nutrition-api-client.interface';

function foodRow(overrides: {
  foodId: number;
  name: string;
  category?: string;
}) {
  return {
    category: 'Vegetable',
    calories: 100,
    proteinG: 10,
    carbsG: 10,
    fatG: 5,
    saturatedFatG: 1,
    sugarG: 2,
    sodiumMg: 50,
    baseUnit: '100g',
    defaultServingWeightGrams: 100,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('NutritionService', () => {
  let service: NutritionService;
  let prisma: {
    foodItem: {
      findMany: jest.Mock;
    };
  };
  let client: { search: jest.Mock; getNutrients: jest.Mock };
  let adapter: { adapt: jest.Mock; adaptNutrients: jest.Mock };

  beforeEach(async () => {
    prisma = {
      foodItem: {
        findMany: jest.fn(),
      },
    };
    client = { search: jest.fn(), getNutrients: jest.fn() };
    adapter = { adapt: jest.fn(), adaptNutrients: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        NutritionService,
        { provide: PrismaService, useValue: prisma },
        { provide: NUTRITION_API_CLIENT, useValue: client },
        { provide: EdamamFoodAdapter, useValue: adapter },
      ],
    }).compile();

    service = module.get(NutritionService);
  });

  describe('search', () => {
    it('returns local matches, never calling the live client', async () => {
      prisma.foodItem.findMany.mockResolvedValue([
        foodRow({ foodId: 1, name: 'Broccoli, raw' }),
      ]);

      const results = await service.search('broccoli');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Broccoli, raw');
      expect(client.search).not.toHaveBeenCalled();
    });

    it('returns an empty array when nothing matches locally, without erroring', async () => {
      prisma.foodItem.findMany.mockResolvedValue([]);

      const results = await service.search('nonexistent food xyz');

      expect(results).toEqual([]);
      expect(client.search).not.toHaveBeenCalled();
    });

    it('searches by case-insensitive substring', async () => {
      prisma.foodItem.findMany.mockResolvedValue([]);

      await service.search('BrocColi');

      expect(prisma.foodItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: { contains: 'BrocColi', mode: 'insensitive' } },
        }),
      );
    });
  });
});
