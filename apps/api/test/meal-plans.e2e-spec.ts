import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import type {
  AuthResponse,
  MealPlan,
  Recipe,
} from '@meal-planning/shared-types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Meal plan generation (e2e, real Strategy/Optimizer/Builder, recipes-only)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const email = `meal-plans-e2e-${randomUUID()}@example.com`;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);
    accessToken = (registerRes.body as AuthResponse).accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${accessToken}` });

  it('rejects generation and listing without a valid access token', async () => {
    await request(app.getHttpServer()).post('/meal-plans/generate').expect(401);
    await request(app.getHttpServer()).get('/meal-plans').expect(401);
  });

  it('rejects generation before a profile has been set up', async () => {
    const res = await request(app.getHttpServer())
      .post('/meal-plans/generate')
      .set(auth())
      .expect(404);
    expect((res.body as { message: string }).message).toMatch(/profile/i);
  });

  it('rejects generation before a weight has been logged', async () => {
    await request(app.getHttpServer())
      .put('/users/me/profile')
      .set(auth())
      .send({
        sex: 'male',
        dateOfBirth: '1990-01-01',
        heightCm: 180,
        activityLevel: 'moderate',
        goal: 'maintenance',
      })
      .expect(200);

    const res = await request(app.getHttpServer())
      .post('/meal-plans/generate')
      .set(auth())
      .expect(404);
    expect((res.body as { message: string }).message).toMatch(/weight/i);
  });

  let generatedPlanId: string;
  let generatedItemCount: number;

  it('generates an empty plan when the user has no saved recipes', async () => {
    await request(app.getHttpServer())
      .post('/logs/weight')
      .set(auth())
      .send({ weightKg: 80 })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/meal-plans/generate')
      .set(auth())
      .send({})
      .expect(201);

    const plan = res.body as MealPlan;
    generatedPlanId = plan.id;
    generatedItemCount = plan.items.length;

    expect(plan.userId).toBeDefined();
    expect(plan.goalSnapshot).toBe('maintenance');
    expect(plan.status).toBe('draft');
    expect(plan.calorieTarget).toBeGreaterThan(0);
    // Recipes-only generation: no saved recipes means every slot's candidate
    // pool is empty. MealPlanBuilder only rejects totals that exceed
    // target*1.15 — an all-empty-slots, 0-calorie draft is valid, not an error.
    expect(plan.items).toHaveLength(0);
  });

  it('persists the plan — it shows up in the listing with the same items', async () => {
    const res = await request(app.getHttpServer())
      .get('/meal-plans')
      .set(auth())
      .expect(200);
    const plans = res.body as MealPlan[];
    const found = plans.find((p) => p.id === generatedPlanId);
    expect(found).toBeDefined();
    expect(found?.items.length).toBe(generatedItemCount);
  });

  it('lists newest plan first', async () => {
    const secondRes = await request(app.getHttpServer())
      .post('/meal-plans/generate')
      .set(auth())
      .send({ date: '2026-01-01' })
      .expect(201);
    const secondPlan = secondRes.body as MealPlan;

    const listRes = await request(app.getHttpServer())
      .get('/meal-plans')
      .set(auth())
      .expect(200);
    const plans = listRes.body as MealPlan[];
    expect(plans[0]?.id).toBe(secondPlan.id);
  });

  describe('per-slot recipe filtering — a recipe is only offered to the slot it is tagged for', () => {
    const slotEmail = `meal-plans-slots-e2e-${randomUUID()}@example.com`;
    let slotAuthToken: string;
    let breakfastRecipe: Recipe;
    let dinnerRecipe: Recipe;
    let plan: MealPlan;

    const slotAuth = () => ({ Authorization: `Bearer ${slotAuthToken}` });
    const slotFoodIds: number[] = [];

    beforeAll(async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: slotEmail, password: 'password123' })
        .expect(201);
      slotAuthToken = (registerRes.body as AuthResponse).accessToken;

      await request(app.getHttpServer())
        .put('/users/me/profile')
        .set(slotAuth())
        .send({
          sex: 'male',
          dateOfBirth: '1990-01-01',
          heightCm: 180,
          activityLevel: 'moderate',
          goal: 'maintenance',
        })
        .expect(200);
      await request(app.getHttpServer())
        .post('/logs/weight')
        .set(slotAuth())
        .send({ weightKg: 80 })
        .expect(201);

      // Baseline generate just to read this user's real calorieTarget —
      // everything below is sized proportionally off it, not hardcoded.
      const baselineRes = await request(app.getHttpServer())
        .post('/meal-plans/generate')
        .set(slotAuth())
        .send({ date: '2026-05-01' })
        .expect(201);
      const calorieTarget = (baselineRes.body as MealPlan).calorieTarget;

      // Deliberately tiny — 5% of daily target, small enough to trivially fit
      // EVERY slot's budget, including snack's 10% share. If either recipe
      // ever showed up in a slot it isn't tagged for, it could only be
      // because the mealSlot filter failed, never a budget/DP coincidence.
      const tinyCalories = Math.round(calorieTarget * 0.05);
      const makeIngredient = async (name: string): Promise<number> => {
        const row = await prisma.foodItem.create({
          data: {
            name,
            category: 'Protein',
            calories: tinyCalories,
            proteinG: 10,
            carbsG: 10,
            fatG: 2,
            saturatedFatG: 0,
            sugarG: 0,
            sodiumMg: 0,
            baseUnit: '100g',
            defaultServingWeightGrams: 100,
          },
        });
        slotFoodIds.push(row.foodId);
        return row.foodId;
      };

      const breakfastIngredientId = await makeIngredient(
        `Tiny Breakfast Ingredient ${randomUUID()}`,
      );
      const breakfastRes = await request(app.getHttpServer())
        .post('/recipes')
        .set(slotAuth())
        .send({
          name: 'Tiny Breakfast Recipe',
          mealSlot: 'breakfast',
          ingredients: [{ foodItemId: breakfastIngredientId, amount: 1 }],
        })
        .expect(201);
      breakfastRecipe = breakfastRes.body as Recipe;

      const dinnerIngredientId = await makeIngredient(
        `Tiny Dinner Ingredient ${randomUUID()}`,
      );
      const dinnerRes = await request(app.getHttpServer())
        .post('/recipes')
        .set(slotAuth())
        .send({
          name: 'Tiny Dinner Recipe',
          mealSlot: 'dinner',
          ingredients: [{ foodItemId: dinnerIngredientId, amount: 1 }],
        })
        .expect(201);
      dinnerRecipe = dinnerRes.body as Recipe;

      // No lunch- or snack-tagged recipe exists for this user at all.
      const planRes = await request(app.getHttpServer())
        .post('/meal-plans/generate')
        .set(slotAuth())
        .send({ date: '2026-05-02' })
        .expect(201);
      plan = planRes.body as MealPlan;
    });

    afterAll(async () => {
      await prisma.user.deleteMany({ where: { email: slotEmail } });
      // food_items has no per-user FK to cascade-delete from — it's a shared,
      // permanent dataset (now local-first-searchable), so these synthetic
      // fixtures must be cleaned up explicitly or they'd leak into real
      // users' searches.
      await prisma.foodItem.deleteMany({
        where: { foodId: { in: slotFoodIds } },
      });
    });

    it('fills a slot from its own tagged recipe', () => {
      const breakfastItems = plan.items.filter(
        (i) => i.mealSlot === 'breakfast',
      );
      expect(breakfastItems).toHaveLength(1);
      expect(breakfastItems[0].recipe?.id).toBe(breakfastRecipe.id);
      expect(breakfastItems[0].foodItem).toBeNull();
    });

    it('excludes a recipe from slots it is not tagged for, and leaves an untagged slot empty', () => {
      const dinnerItems = plan.items.filter((i) => i.mealSlot === 'dinner');
      expect(dinnerItems).toHaveLength(1);
      expect(dinnerItems[0].recipe?.id).toBe(dinnerRecipe.id);

      // Neither recipe leaks into lunch or snack, despite being cheap enough
      // (5% of daily target) to easily fit either budget.
      expect(plan.items.filter((i) => i.mealSlot === 'lunch')).toHaveLength(0);
      expect(plan.items.filter((i) => i.mealSlot === 'snack')).toHaveLength(0);

      // Recipes-only, globally: nothing in the whole plan is Edamam-sourced.
      expect(plan.items.every((i) => i.foodItem === null)).toBe(true);
      expect(plan.items.every((i) => i.recipe !== null)).toBe(true);
    });
  });

  describe('Adding an item directly to a plan (Find meal)', () => {
    const addItemEmail = `meal-plans-additem-e2e-${randomUUID()}@example.com`;
    let addItemToken: string;
    let planId: string;
    let recipe: Recipe;

    const addItemAuth = () => ({ Authorization: `Bearer ${addItemToken}` });
    const addItemFoodIds: number[] = [];

    beforeAll(async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: addItemEmail, password: 'password123' })
        .expect(201);
      addItemToken = (registerRes.body as AuthResponse).accessToken;

      await request(app.getHttpServer())
        .put('/users/me/profile')
        .set(addItemAuth())
        .send({
          sex: 'male',
          dateOfBirth: '1990-01-01',
          heightCm: 180,
          activityLevel: 'moderate',
          goal: 'maintenance',
        })
        .expect(200);
      await request(app.getHttpServer())
        .post('/logs/weight')
        .set(addItemAuth())
        .send({ weightKg: 80 })
        .expect(201);

      const planRes = await request(app.getHttpServer())
        .post('/meal-plans/generate')
        .set(addItemAuth())
        .send({ date: '2026-04-01' })
        .expect(201);
      planId = (planRes.body as MealPlan).id;

      const snackIngredient = await prisma.foodItem.create({
        data: {
          name: `Add-Item Snack Ingredient ${randomUUID()}`,
          category: 'Protein',
          calories: 100,
          proteinG: 5,
          carbsG: 10,
          fatG: 2,
          saturatedFatG: 0,
          sugarG: 0,
          sodiumMg: 0,
          baseUnit: '100g',
          defaultServingWeightGrams: 100,
        },
      });
      addItemFoodIds.push(snackIngredient.foodId);

      const recipeRes = await request(app.getHttpServer())
        .post('/recipes')
        .set(addItemAuth())
        .send({
          name: 'Add-Item Snack',
          mealSlot: 'snack',
          ingredients: [{ foodItemId: snackIngredient.foodId, amount: 1 }],
        })
        .expect(201);
      recipe = recipeRes.body as Recipe;
    });

    afterAll(async () => {
      await prisma.user.deleteMany({ where: { email: addItemEmail } });
      // food_items has no per-user FK to cascade-delete from — see the
      // per-slot-filtering block's afterAll above for why this matters.
      await prisma.foodItem.deleteMany({
        where: { foodId: { in: addItemFoodIds } },
      });
    });

    it('rejects without a valid access token', async () => {
      await request(app.getHttpServer())
        .post(`/meal-plans/${planId}/items`)
        .send({ mealSlot: 'snack', servings: 1, recipeId: recipe.id })
        .expect(401);
    });

    it('404s for a non-existent plan', async () => {
      await request(app.getHttpServer())
        .post('/meal-plans/00000000-0000-0000-0000-000000000000/items')
        .set(addItemAuth())
        .send({ mealSlot: 'snack', servings: 1, recipeId: recipe.id })
        .expect(404);
    });

    it('rejects when neither recipeId nor foodItemId is provided', async () => {
      await request(app.getHttpServer())
        .post(`/meal-plans/${planId}/items`)
        .set(addItemAuth())
        .send({ mealSlot: 'snack', servings: 1 })
        .expect(400);
    });

    it('adds a recipe-sourced item, scaled by servings', async () => {
      const res = await request(app.getHttpServer())
        .post(`/meal-plans/${planId}/items`)
        .set(addItemAuth())
        .send({ mealSlot: 'snack', servings: 2, recipeId: recipe.id })
        .expect(201);
      const plan = res.body as MealPlan;
      const added = plan.items.find((i) => i.recipe?.id === recipe.id);
      expect(added).toBeDefined();
      expect(added?.foodItem).toBeNull();
      expect(added?.servings).toBe(2);
      expect(added?.calories).toBeCloseTo(recipe.calories * 2, 5);
    });

    it('adds a food-sourced item, referencing an existing food_items row', async () => {
      const freshFood = await prisma.foodItem.create({
        data: {
          name: `Fresh Add-Item Food ${randomUUID()}`,
          category: 'Protein',
          calories: 50,
          proteinG: 3,
          carbsG: 5,
          fatG: 1,
          saturatedFatG: 0,
          sugarG: 0,
          sodiumMg: 0,
          baseUnit: '100g',
          defaultServingWeightGrams: 100,
        },
      });
      addItemFoodIds.push(freshFood.foodId);

      const res = await request(app.getHttpServer())
        .post(`/meal-plans/${planId}/items`)
        .set(addItemAuth())
        .send({
          mealSlot: 'lunch',
          servings: 1.5,
          foodItemId: freshFood.foodId,
        })
        .expect(201);
      const plan = res.body as MealPlan;
      const added = plan.items.find(
        (i) => i.foodItem?.id === String(freshFood.foodId),
      );
      expect(added).toBeDefined();
      expect(added?.recipe).toBeNull();
      expect(added?.servings).toBe(1.5);
      expect(added?.calories).toBeCloseTo(Number(freshFood.calories) * 1.5, 5);
    });

    it("rejects adding to another user's plan", async () => {
      const otherEmail = `additem-other-e2e-${randomUUID()}@example.com`;
      const otherRegisterRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: otherEmail, password: 'password123' })
        .expect(201);
      const otherToken = (otherRegisterRes.body as AuthResponse).accessToken;

      await request(app.getHttpServer())
        .post(`/meal-plans/${planId}/items`)
        .set({ Authorization: `Bearer ${otherToken}` })
        .send({ mealSlot: 'snack', servings: 1, recipeId: recipe.id })
        .expect(403);

      await prisma.user.deleteMany({ where: { email: otherEmail } });
    });
  });
});
