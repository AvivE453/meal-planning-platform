import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import type {
  AuthResponse,
  DailyNutritionLog,
  MealPlan,
  Recipe,
} from '@meal-planning/shared-types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Nutrition logging (e2e, manual / meal_plan / search sources)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const email = `nutrition-logs-e2e-${randomUUID()}@example.com`;
  let accessToken: string;
  let mealPlanItemId: string;
  const seededFoodIds: number[] = [];

  async function createFoodItem(
    data: Partial<Parameters<PrismaService['foodItem']['create']>[0]['data']> &
      Pick<Parameters<PrismaService['foodItem']['create']>[0]['data'], 'name'>,
  ): Promise<number> {
    const row = await prisma.foodItem.create({
      data: {
        category: 'Protein',
        calories: 100,
        proteinG: 10,
        carbsG: 10,
        fatG: 5,
        saturatedFatG: 1,
        sugarG: 2,
        sodiumMg: 50,
        baseUnit: '100g',
        defaultServingWeightGrams: 100,
        ...data,
      },
    });
    seededFoodIds.push(row.foodId);
    return row.foodId;
  }

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
    await request(app.getHttpServer())
      .post('/logs/weight')
      .set(auth())
      .send({ weightKg: 80 })
      .expect(201);

    const planRes = await request(app.getHttpServer())
      .post('/meal-plans/generate')
      .set(auth())
      .send({})
      .expect(201);
    const planId = (planRes.body as MealPlan).id;

    // Recipes-only generation means this user (no saved recipes yet) gets an
    // empty plan — use the "Find meal" add-item endpoint to get a real
    // food-sourced item, since the tests below specifically exercise the
    // source:'meal_plan' -> foodItemId branch (as opposed to the recipe-backed
    // branch, covered separately by the "regression" block further down).
    const setupFoodItemId = await createFoodItem({
      name: `Setup Food Item ${randomUUID()}`,
      calories: 200,
      proteinG: 10,
      carbsG: 20,
      fatG: 5,
      sugarG: 2,
      sodiumMg: 100,
    });
    const addItemRes = await request(app.getHttpServer())
      .post(`/meal-plans/${planId}/items`)
      .set(auth())
      .send({
        mealSlot: 'breakfast',
        servings: 1,
        foodItemId: setupFoodItemId,
      })
      .expect(201);
    mealPlanItemId = (addItemRes.body as MealPlan).items.find(
      (i) => i.foodItem?.id === String(setupFoodItemId),
    )!.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    // food_items has no per-user FK to cascade-delete from — it's a shared,
    // permanent dataset (now local-first-searchable), so the rows this file
    // seeds across its nested describe blocks must be cleaned up explicitly
    // or they'd leak into real users' searches.
    if (seededFoodIds.length > 0) {
      await prisma.foodItem.deleteMany({
        where: { foodId: { in: seededFoodIds } },
      });
    }
    await app.close();
  });

  function auth() {
    return { Authorization: `Bearer ${accessToken}` };
  }

  it('rejects requests without a valid access token', async () => {
    await request(app.getHttpServer()).post('/logs/nutrition').expect(401);
    await request(app.getHttpServer()).get('/logs/nutrition').expect(401);
  });

  describe('source: manual', () => {
    it('logs raw totals with no food/plan reference', async () => {
      const res = await request(app.getHttpServer())
        .post('/logs/nutrition')
        .set(auth())
        .send({
          source: 'manual',
          calories: 450,
          proteinG: 30,
          carbsG: 40,
          fatG: 15,
        })
        .expect(201);

      const body = res.body as DailyNutritionLog;
      expect(body.source).toBe('manual');
      expect(body.foodItem).toBeNull();
      expect(body.mealPlanItemId).toBeNull();
      expect(body.servings).toBe(1);
      expect(body.calories).toBe(450);
      expect(body.date).toBeDefined();
    });

    it('rejects a manual entry missing required totals', async () => {
      await request(app.getHttpServer())
        .post('/logs/nutrition')
        .set(auth())
        .send({ source: 'manual', calories: 450 })
        .expect(400);
    });
  });

  describe('source: search', () => {
    let searchedFoodItemId: number;

    beforeAll(async () => {
      searchedFoodItemId = await createFoodItem({
        name: `chicken breast (fake result) ${randomUUID()}`,
        calories: 165,
        proteinG: 31,
        carbsG: 0,
        fatG: 3.6,
        sugarG: 0,
        sodiumMg: 74,
      });
    });

    it('logs a searched food, scaled by servings', async () => {
      const res = await request(app.getHttpServer())
        .post('/logs/nutrition')
        .set(auth())
        .send({ source: 'search', foodItemId: searchedFoodItemId, servings: 2 })
        .expect(201);

      const body = res.body as DailyNutritionLog;
      expect(body.source).toBe('search');
      expect(body.servings).toBe(2);
      expect(body.calories).toBe(330); // 165 * 2
      expect(body.proteinG).toBe(62); // 31 * 2
      expect(body.foodItem?.id).toBe(String(searchedFoodItemId));
      expect(body.mealPlanItemId).toBeNull();
    });

    it('rejects a search entry with no servings', async () => {
      await request(app.getHttpServer())
        .post('/logs/nutrition')
        .set(auth())
        .send({ source: 'search', foodItemId: searchedFoodItemId })
        .expect(400);
    });

    it('404s for a foodItemId that does not exist', async () => {
      await request(app.getHttpServer())
        .post('/logs/nutrition')
        .set(auth())
        .send({ source: 'search', foodItemId: 999999999, servings: 1 })
        .expect(404);
    });
  });

  describe('source: meal_plan', () => {
    it("defaults servings to the plan item's own serving count", async () => {
      const itemRes = await request(app.getHttpServer())
        .get('/meal-plans')
        .set(auth())
        .expect(200);
      const plan = (itemRes.body as MealPlan[])[0];
      const planItem = plan.items.find((i) => i.id === mealPlanItemId)!;

      const res = await request(app.getHttpServer())
        .post('/logs/nutrition')
        .set(auth())
        .send({ source: 'meal_plan', mealPlanItemId })
        .expect(201);

      const body = res.body as DailyNutritionLog;
      expect(body.source).toBe('meal_plan');
      expect(body.mealPlanItemId).toBe(mealPlanItemId);
      expect(body.servings).toBe(planItem.servings);
      expect(body.calories).toBeCloseTo(planItem.calories, 5);
      expect(body.foodItem?.id).toBe(planItem.foodItem?.id);
    });

    it('scales macros when a different servings amount is given', async () => {
      const res = await request(app.getHttpServer())
        .post('/logs/nutrition')
        .set(auth())
        .send({ source: 'meal_plan', mealPlanItemId, servings: 1 })
        .expect(201);

      const body = res.body as DailyNutritionLog;
      expect(body.servings).toBe(1);
      // Per-serving values come from the food item, not a naive re-scale of
      // the plan item's own (possibly multi-serving) totals.
      expect(body.calories).toBeCloseTo(body.foodItem!.calories * 1, 5);
    });

    it('404s for a meal plan item that does not exist', async () => {
      await request(app.getHttpServer())
        .post('/logs/nutrition')
        .set(auth())
        .send({ source: 'meal_plan', mealPlanItemId: randomUUID() })
        .expect(404);
    });

    it("403s for another user's meal plan item", async () => {
      const otherEmail = `nutrition-logs-e2e-other-${randomUUID()}@example.com`;
      const otherReg = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: otherEmail, password: 'password123' })
        .expect(201);
      const otherToken = (otherReg.body as AuthResponse).accessToken;

      await request(app.getHttpServer())
        .post('/logs/nutrition')
        .set({ Authorization: `Bearer ${otherToken}` })
        .send({ source: 'meal_plan', mealPlanItemId })
        .expect(403);

      await prisma.user.deleteMany({ where: { email: otherEmail } });
    });
  });

  describe('source: recipe', () => {
    let recipe: Recipe;

    beforeAll(async () => {
      const oatsId = await createFoodItem({
        name: `Oats (fake) ${randomUUID()}`,
        category: 'Grain',
        calories: 150,
        proteinG: 5,
        carbsG: 27,
        fatG: 3,
        sugarG: 1,
        sodiumMg: 2,
      });
      const wheyId = await createFoodItem({
        name: `Whey Protein (fake) ${randomUUID()}`,
        calories: 120,
        proteinG: 24,
        carbsG: 3,
        fatG: 1,
        sugarG: 1,
        sodiumMg: 50,
      });

      const res = await request(app.getHttpServer())
        .post('/recipes')
        .set(auth())
        .send({
          name: 'Protein Oats',
          mealSlot: 'breakfast',
          ingredients: [
            { foodItemId: oatsId, amount: 1 },
            { foodItemId: wheyId, amount: 1 },
          ],
        })
        .expect(201);
      recipe = res.body as Recipe;
    });

    it('logs a saved recipe directly, scaled by servings', async () => {
      const res = await request(app.getHttpServer())
        .post('/logs/nutrition')
        .set(auth())
        .send({ source: 'recipe', recipeId: recipe.id, servings: 2 })
        .expect(201);

      const body = res.body as DailyNutritionLog;
      expect(body.source).toBe('recipe');
      expect(body.servings).toBe(2);
      expect(body.recipe?.id).toBe(recipe.id);
      expect(body.foodItem).toBeNull();
      expect(body.mealPlanItemId).toBeNull();
      // (150+120) * 2 = 540
      expect(body.calories).toBeCloseTo(540, 5);
      expect(body.proteinG).toBeCloseTo((5 + 24) * 2, 5);
    });

    it('rejects a recipe entry with no servings', async () => {
      await request(app.getHttpServer())
        .post('/logs/nutrition')
        .set(auth())
        .send({ source: 'recipe', recipeId: recipe.id })
        .expect(400);
    });

    it('404s for a recipe that does not exist', async () => {
      await request(app.getHttpServer())
        .post('/logs/nutrition')
        .set(auth())
        .send({ source: 'recipe', recipeId: randomUUID(), servings: 1 })
        .expect(404);
    });

    it("403s for another user's recipe", async () => {
      const otherEmail = `recipe-log-other-${randomUUID()}@example.com`;
      const otherReg = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: otherEmail, password: 'password123' })
        .expect(201);
      const otherToken = (otherReg.body as AuthResponse).accessToken;

      await request(app.getHttpServer())
        .post('/logs/nutrition')
        .set({ Authorization: `Bearer ${otherToken}` })
        .send({ source: 'recipe', recipeId: recipe.id, servings: 1 })
        .expect(403);

      await prisma.user.deleteMany({ where: { email: otherEmail } });
    });
  });

  describe('source: meal_plan, backed by a recipe-sourced plan item (regression)', () => {
    const recipeEmail = `recipe-log-plan-${randomUUID()}@example.com`;
    let recipeToken: string;
    let recipe: Recipe;
    let recipeMealPlanItemId: string;

    const recipeAuth = () => ({ Authorization: `Bearer ${recipeToken}` });

    beforeAll(async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: recipeEmail, password: 'password123' })
        .expect(201);
      recipeToken = (registerRes.body as AuthResponse).accessToken;

      await request(app.getHttpServer())
        .put('/users/me/profile')
        .set(recipeAuth())
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
        .set(recipeAuth())
        .send({ weightKg: 80 })
        .expect(201);

      const baselineRes = await request(app.getHttpServer())
        .post('/meal-plans/generate')
        .set(recipeAuth())
        .send({ date: '2026-03-10' })
        .expect(201);
      const calorieTarget = (baselineRes.body as MealPlan).calorieTarget;

      // Sized to comfortably fit breakfast's own 25%-of-target share — with
      // recipes-only generation this just needs to fit the budget, not avoid
      // triggering an Edamam fallback (that fallback no longer exists).
      // mealSlot: 'breakfast' is what actually makes this recipe eligible for
      // the assertion below, now that generation filters per-slot.
      const recipeCalories = Math.round(calorieTarget * 0.25 * 0.95);
      const bowlId = await createFoodItem({
        name: `Regression Bowl Mix ${randomUUID()}`,
        calories: recipeCalories,
        proteinG: 40,
        carbsG: 40,
        fatG: 10,
        sugarG: 0,
        sodiumMg: 0,
      });
      const createRes = await request(app.getHttpServer())
        .post('/recipes')
        .set(recipeAuth())
        .send({
          name: 'Regression Breakfast Bowl',
          mealSlot: 'breakfast',
          ingredients: [{ foodItemId: bowlId, amount: 1 }],
        })
        .expect(201);
      recipe = createRes.body as Recipe;

      const planRes = await request(app.getHttpServer())
        .post('/meal-plans/generate')
        .set(recipeAuth())
        .send({ date: '2026-03-11' })
        .expect(201);
      const plan = planRes.body as MealPlan;
      const breakfastItem = plan.items.find(
        (i) => i.mealSlot === 'breakfast' && i.recipe?.id === recipe.id,
      );
      expect(breakfastItem).toBeDefined();
      recipeMealPlanItemId = breakfastItem!.id;
    });

    afterAll(async () => {
      await prisma.user.deleteMany({ where: { email: recipeEmail } });
    });

    it("resolves nutrition from the recipe's own aggregate, not a null food item", async () => {
      const res = await request(app.getHttpServer())
        .post('/logs/nutrition')
        .set(recipeAuth())
        .send({ source: 'meal_plan', mealPlanItemId: recipeMealPlanItemId })
        .expect(201);

      const body = res.body as DailyNutritionLog;
      expect(body.source).toBe('meal_plan');
      expect(body.mealPlanItemId).toBe(recipeMealPlanItemId);
      expect(body.recipe?.id).toBe(recipe.id);
      expect(body.foodItem).toBeNull();
      expect(body.calories).toBeGreaterThan(0);
    });
  });

  describe('list and delete', () => {
    let loggedId: string;

    it('creates an entry to list and delete', async () => {
      const res = await request(app.getHttpServer())
        .post('/logs/nutrition')
        .set(auth())
        .send({
          source: 'manual',
          calories: 100,
          proteinG: 5,
          carbsG: 10,
          fatG: 2,
        })
        .expect(201);
      loggedId = (res.body as DailyNutritionLog).id;
    });

    it('lists logged entries, newest first', async () => {
      const res = await request(app.getHttpServer())
        .get('/logs/nutrition')
        .set(auth())
        .expect(200);
      const logs = res.body as DailyNutritionLog[];
      expect(logs.some((l) => l.id === loggedId)).toBe(true);
    });

    it('deletes an entry', async () => {
      await request(app.getHttpServer())
        .delete(`/logs/nutrition/${loggedId}`)
        .set(auth())
        .expect(204);

      const res = await request(app.getHttpServer())
        .get('/logs/nutrition')
        .set(auth())
        .expect(200);
      expect(
        (res.body as DailyNutritionLog[]).some((l) => l.id === loggedId),
      ).toBe(false);
    });
  });
});
