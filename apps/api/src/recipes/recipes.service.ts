import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Recipe } from '@meal-planning/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { toRecipe } from './recipe.mapper';
import type { CreateRecipeDto } from './dto/create-recipe.dto';

const RECIPE_INCLUDE = {
  ingredients: { include: { foodItem: true } },
} as const;

@Injectable()
export class RecipesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateRecipeDto): Promise<Recipe> {
    const recipeId = await this.prisma.$transaction(async (tx) => {
      const recipe = await tx.recipe.create({
        data: { userId, name: dto.name, mealSlot: dto.mealSlot },
      });

      let sortOrder = 0;
      for (const ingredient of dto.ingredients) {
        const existing = await tx.foodItem.findUnique({
          where: { foodId: ingredient.foodItemId },
        });
        if (!existing) {
          throw new NotFoundException(
            `Food item ${ingredient.foodItemId} not found`,
          );
        }

        await tx.recipeIngredient.create({
          data: {
            recipeId: recipe.id,
            foodItemId: existing.foodId,
            amount: ingredient.amount,
            sortOrder: sortOrder++,
          },
        });
      }

      return recipe.id;
    });

    return this.findOne(userId, recipeId);
  }

  async findAllByUserId(userId: string, q?: string): Promise<Recipe[]> {
    const recipes = await this.prisma.recipe.findMany({
      where: {
        userId,
        name: q ? { contains: q, mode: 'insensitive' } : undefined,
      },
      include: RECIPE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return recipes.map(toRecipe);
  }

  async findOne(userId: string, id: string): Promise<Recipe> {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id },
      include: RECIPE_INCLUDE,
    });
    if (!recipe) {
      throw new NotFoundException('Recipe not found');
    }
    if (recipe.userId !== userId) {
      throw new ForbiddenException();
    }
    return toRecipe(recipe);
  }

  async remove(userId: string, id: string): Promise<void> {
    const recipe = await this.prisma.recipe.findUnique({ where: { id } });
    if (!recipe) {
      throw new NotFoundException('Recipe not found');
    }
    if (recipe.userId !== userId) {
      throw new ForbiddenException();
    }
    await this.prisma.recipe.delete({ where: { id } });
  }
}
