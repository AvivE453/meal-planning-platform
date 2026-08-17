import {
  Injectable,
  Logger,
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
import type { MealPlanDraft } from '@meal-planning/algorithm';
import type { FoodItem, MealPlan, MealSlot } from '@meal-planning/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileService } from '../profile/profile.service';
import { WeightLogsService } from '../logs/weight-logs.service';
import { RestrictionsService } from '../restrictions/restrictions.service';
import { NutritionService } from '../nutrition/nutrition.service';
import { upsertFoodItem } from '../nutrition/food-item-persistence';
import { filterByRestrictions } from './restriction-filter';
import {
  SLOT_CALORIE_SHARE,
  SLOT_CANDIDATE_QUERIES,
  SLOT_ORDER,
} from './candidate-queries';
import { toMealPlan } from './meal-plan.mapper';

@Injectable()
export class MealPlansService {
  private readonly logger = new Logger(MealPlansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly profileService: ProfileService,
    private readonly weightLogsService: WeightLogsService,
    private readonly restrictionsService: RestrictionsService,
    private readonly nutritionService: NutritionService,
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

    const planDate = date ?? new Date().toISOString().slice(0, 10);
    const builder = new MealPlanBuilder()
      .forUser(userId)
      .forDate(planDate)
      .withStrategy(strategy, calorieTarget);

    for (const slot of SLOT_ORDER) {
      const candidates = await this.gatherCandidates(slot);
      const allowed = filterByRestrictions(
        filterExcluded(candidates, exclusionRules),
        restrictions,
      );
      const slotBudget = calorieTarget * SLOT_CALORIE_SHARE[slot];
      builder.addSlot(slot, optimizeSlot(allowed, slotBudget, weights));
    }

    const draft = this.buildOrThrow(builder);
    return this.persist(draft);
  }

  async findAllByUserId(userId: string): Promise<MealPlan[]> {
    const plans = await this.prisma.mealPlan.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { foodItem: true }, orderBy: { sortOrder: 'asc' } },
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
   * Pools candidates from a slot's fixed search-term list, deduped by food id
   * (the same food often turns up for more than one term). Runs through the
   * existing cached search path, so a warm Redis cache makes this fast even
   * though generation issues several live-shaped calls per slot.
   *
   * Sequential, not Promise.all, to avoid a self-inflicted concurrency spike.
   * More importantly, each term's search failure is caught and skipped rather
   * than left to abort the whole generation: live-verifying against Edamam's
   * free tier showed a real requests-per-minute cap well below what a full
   * cold-cache generation needs in one burst (up to 16 live calls across 4
   * slots). One flaky/rate-limited term should degrade that slot's candidate
   * pool, not fail the entire plan — and after the first successful run, most
   * terms are Redis hits and never touch Edamam's limit again anyway.
   */
  private async gatherCandidates(slot: MealSlot): Promise<FoodItem[]> {
    const byId = new Map<string, FoodItem>();
    for (const term of SLOT_CANDIDATE_QUERIES[slot]) {
      try {
        const items = await this.nutritionService.search(term);
        for (const item of items) {
          if (!byId.has(item.id)) {
            byId.set(item.id, item);
          }
        }
      } catch (err) {
        this.logger.warn(
          `Candidate search failed for "${term}" (${slot}): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return [...byId.values()];
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
        const foodItem = await upsertFoodItem(tx, itemDraft.foodItem);

        await tx.mealPlanItem.create({
          data: {
            mealPlanId: plan.id,
            foodItemId: foodItem.id,
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
        items: { include: { foodItem: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
    return toMealPlan(plan);
  }
}
