import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  calculateAge,
  calculateTdee,
  filterExcluded,
  MealPlanBuilder,
  optimizeSlot,
  StrategyFactory,
} from '@meal-planning/algorithm';
import type { MealPlanDraft, SelectedItem } from '@meal-planning/algorithm';
import type {
  FoodItem,
  MacroWeights,
  MealPlan,
  ExclusionRule,
  DietaryRestriction,
} from '@meal-planning/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileService } from '../profile/profile.service';
import { WeightLogsService } from '../logs/weight-logs.service';
import { RestrictionsService } from '../restrictions/restrictions.service';
import { upsertFoodItem } from '../nutrition/food-item-persistence';
import { RecipesService } from '../recipes/recipes.service';
import { toRecipeCandidate, recipeIdOf } from '../recipes/recipe-candidate';
import { filterByRestrictions } from './restriction-filter';
import { SLOT_CALORIE_SHARE, SLOT_ORDER } from './candidate-queries';
import { toMealPlan } from './meal-plan.mapper';
import type { AddMealPlanItemDto } from './dto/add-meal-plan-item.dto';

@Injectable()
export class MealPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profileService: ProfileService,
    private readonly weightLogsService: WeightLogsService,
    private readonly restrictionsService: RestrictionsService,
    private readonly recipesService: RecipesService,
  ) {}

  async generate(userId: string, date?: string): Promise<MealPlan> {
    const profile = await this.profileService.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException(
        'Set up your profile before generating a meal plan',
      );
    }
    const latestWeight =
      await this.weightLogsService.findLatestByUserId(userId);
    if (!latestWeight) {
      throw new NotFoundException(
        'Log a weight entry before generating a meal plan',
      );
    }
    const restrictions = await this.restrictionsService.findAllByUserId(userId);

    const tdee = calculateTdee({
      sex: profile.sex,
      age: calculateAge(profile.dateOfBirth),
      heightCm: profile.heightCm,
      weightKg: latestWeight.weightKg,
      activityLevel: profile.activityLevel,
    });

    const strategy = StrategyFactory.forGoal(profile.goal);
    const calorieTarget = strategy.calculateDailyCalorieTarget(profile, tdee);
    const weights = strategy.getMacroWeights();
    const exclusionRules = strategy.getExclusionRules();

    // Recipes are now slot-tagged (Recipe.mealSlot) — each slot only ever
    // sees the recipes tagged for it, not the user's whole recipe list.
    const recipes = await this.recipesService.findAllByUserId(userId);

    const planDate = date ?? new Date().toISOString().slice(0, 10);
    const builder = new MealPlanBuilder()
      .forUser(userId)
      .forDate(planDate)
      .withStrategy(strategy, calorieTarget);

    for (const slot of SLOT_ORDER) {
      const slotBudget = calorieTarget * SLOT_CALORIE_SHARE[slot];
      const candidates = recipes
        .filter((recipe) => recipe.mealSlot === slot)
        .map(toRecipeCandidate);
      const selections = this.selectSlotItems(
        candidates,
        slotBudget,
        exclusionRules,
        restrictions,
        weights,
      );
      builder.addSlot(slot, selections);
    }

    const draft = this.buildOrThrow(builder);
    return this.persist(draft);
  }

  /**
   * Recipes-only: a slot's candidates are exactly the user's own recipes
   * tagged for that slot. A slot with no matching recipes (or none that fit
   * the budget/restrictions) simply comes back empty — MealPlanBuilder only
   * rejects a plan for going *over* target, never under.
   */
  private selectSlotItems(
    candidates: FoodItem[],
    slotBudget: number,
    exclusionRules: ExclusionRule[],
    restrictions: DietaryRestriction[],
    weights: MacroWeights,
  ): SelectedItem[] {
    const allowed = filterByRestrictions(
      filterExcluded(candidates, exclusionRules),
      restrictions,
    );
    return optimizeSlot(allowed, slotBudget, weights);
  }

  /**
   * "Find meal" flow: adds a single food or recipe to an already-generated
   * plan, distinct from whole-plan generation. Doesn't go through
   * MealPlanBuilder's calorie-tolerance check — that guards the optimizer's
   * own output, not a deliberate manual addition the user asked for.
   */
  async addItem(
    userId: string,
    planId: string,
    dto: AddMealPlanItemDto,
  ): Promise<MealPlan> {
    const plan = await this.prisma.mealPlan.findUnique({
      where: { id: planId },
    });
    if (!plan) {
      throw new NotFoundException('Meal plan not found');
    }
    if (plan.userId !== userId) {
      throw new ForbiddenException();
    }
    if (!dto.recipeId && !dto.foodItemId) {
      throw new BadRequestException('Provide either recipeId or foodItemId');
    }

    await this.prisma.$transaction(async (tx) => {
      let foodItemId: number | null = null;
      let recipeId: string | null = null;
      let perServing: {
        calories: number;
        proteinG: number;
        carbsG: number;
        fatG: number;
      };

      if (dto.recipeId) {
        // findOne already 404s/403s on a missing or not-owned recipe.
        const recipe = await this.recipesService.findOne(userId, dto.recipeId);
        recipeId = recipe.id;
        perServing = {
          calories: recipe.calories,
          proteinG: recipe.proteinG,
          carbsG: recipe.carbsG,
          fatG: recipe.fatG,
        };
      } else {
        const foodItem = await tx.foodItem.findUnique({
          where: { foodId: dto.foodItemId! },
        });
        if (!foodItem) {
          throw new NotFoundException(`Food item ${dto.foodItemId} not found`);
        }
        foodItemId = foodItem.foodId;
        perServing = {
          calories: Number(foodItem.calories),
          proteinG: Number(foodItem.proteinG),
          carbsG: Number(foodItem.carbsG),
          fatG: Number(foodItem.fatG),
        };
      }

      const { _max } = await tx.mealPlanItem.aggregate({
        where: { mealPlanId: planId },
        _max: { sortOrder: true },
      });
      const sortOrder = (_max.sortOrder ?? -1) + 1;

      await tx.mealPlanItem.create({
        data: {
          mealPlanId: planId,
          foodItemId,
          recipeId,
          mealSlot: dto.mealSlot,
          servings: dto.servings,
          calories: perServing.calories * dto.servings,
          proteinG: perServing.proteinG * dto.servings,
          carbsG: perServing.carbsG * dto.servings,
          fatG: perServing.fatG * dto.servings,
          sortOrder,
        },
      });
    });

    const updated = await this.prisma.mealPlan.findUniqueOrThrow({
      where: { id: planId },
      include: {
        items: {
          include: { foodItem: true, recipe: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    return toMealPlan(updated);
  }

  async findAllByUserId(userId: string): Promise<MealPlan[]> {
    const plans = await this.prisma.mealPlan.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: { foodItem: true, recipe: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    return plans.map(toMealPlan);
  }

  /** MealPlanBuilder.build() throws when assembled totals drift too far over target — surface that as a clean 422. */
  private buildOrThrow(builder: MealPlanBuilder): Readonly<MealPlanDraft> {
    try {
      return builder.build();
    } catch (err) {
      throw new UnprocessableEntityException(
        err instanceof Error
          ? err.message
          : 'Could not generate a meal plan from the available candidates',
      );
    }
  }

  /**
   * Persists the plan and its items inside one transaction, upserting a durable
   * food_items row per selected food (keyed on source+externalId) since
   * MealPlanItem's FK requires one — not every search hit gets a row, only
   * foods that actually end up in a plan. Re-reads the plan after commit so
   * the response and findAllByUserId share one mapping path (meal-plan.mapper).
   */
  private async persist(draft: Readonly<MealPlanDraft>): Promise<MealPlan> {
    const planId = await this.prisma.$transaction(async (tx) => {
      const plan = await tx.mealPlan.create({
        data: {
          userId: draft.userId,
          date: new Date(draft.date),
          goalSnapshot: draft.goalSnapshot,
          calorieTarget: draft.calorieTarget,
          proteinTargetG: draft.macroTargets.proteinG,
          carbsTargetG: draft.macroTargets.carbsG,
          fatTargetG: draft.macroTargets.fatG,
        },
      });

      for (const itemDraft of draft.items) {
        const recipeId = recipeIdOf(itemDraft.foodItem);
        // A recipe-sourced candidate never gets a food_items row (see
        // recipe-candidate.ts) — its own denormalized calories/macros below
        // are all persistence needs; foodItemId stays null.
        const foodItemId = recipeId
          ? null
          : (await upsertFoodItem(tx, itemDraft.foodItem)).foodId;

        await tx.mealPlanItem.create({
          data: {
            mealPlanId: plan.id,
            foodItemId,
            recipeId,
            mealSlot: itemDraft.mealSlot,
            servings: itemDraft.servings,
            calories: itemDraft.calories,
            proteinG: itemDraft.proteinG,
            carbsG: itemDraft.carbsG,
            fatG: itemDraft.fatG,
            sortOrder: itemDraft.sortOrder,
          },
        });
      }

      return plan.id;
    });

    const plan = await this.prisma.mealPlan.findUniqueOrThrow({
      where: { id: planId },
      include: {
        items: {
          include: { foodItem: true, recipe: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    return toMealPlan(plan);
  }
}
