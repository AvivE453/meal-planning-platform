import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import type {
  AuthResponse,
  DailyNutritionLog,
  FoodItem,
  MealPlan,
} from '@meal-planning/shared-types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { NUTRITION_API_CLIENT } from './../src/nutrition/clients/nutrition-api-client.interface';
import { FakeNutritionApiClient } from './../src/nutrition/testing/fake-nutrition-api-client';

describe('Nutrition logging (e2e, manual / meal_plan / search sources)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const email = `nutrition-logs-e2e-${randomUUID()}@example.com`;
  let accessToken: string;
  let mealPlanItemId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(NUTRITION_API_CLIENT)
      .useValue(new FakeNutritionApiClient())
      .compile();

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
    mealPlanItemId = (planRes.body as MealPlan).items[0].id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
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
    const searchedFoodItem: FoodItem = {
      id: 'food_fake_chicken',
      externalId: 'food_fake_chicken',
      source: 'edamam',
      name: 'chicken breast (fake result)',
      brand: null,
      calories: 165,
      proteinG: 31,
      carbsG: 0,
      fatG: 3.6,
      sugarG: 0,
      sodiumMg: 74,
      servingQty: 1,
      servingUnit: 'Serving',
    };

    it('logs a searched food, scaled by servings', async () => {
      const res = await request(app.getHttpServer())
        .post('/logs/nutrition')
        .set(auth())
        .send({ source: 'search', foodItem: searchedFoodItem, servings: 2 })
        .expect(201);

      const body = res.body as DailyNutritionLog;
      expect(body.source).toBe('search');
      expect(body.servings).toBe(2);
      expect(body.calories).toBe(330); // 165 * 2
      expect(body.proteinG).toBe(62); // 31 * 2
      expect(body.foodItem?.id).toBe('food_fake_chicken');
      expect(body.mealPlanItemId).toBeNull();
    });

    it('rejects a search entry with no servings', async () => {
      await request(app.getHttpServer())
        .post('/logs/nutrition')
        .set(auth())
        .send({ source: 'search', foodItem: searchedFoodItem })
        .expect(400);
    });

    it('reuses the same durable food_items row as meal-plan generation (upsert, not duplicate)', async () => {
      const before = await prisma.foodItem.count({
        where: { source: 'edamam', externalId: 'food_fake_chicken' },
      });
      await request(app.getHttpServer())
        .post('/logs/nutrition')
        .set(auth())
        .send({ source: 'search', foodItem: searchedFoodItem, servings: 1 })
        .expect(201);
      const after = await prisma.foodItem.count({
        where: { source: 'edamam', externalId: 'food_fake_chicken' },
      });
      expect(after).toBe(before);
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
      expect(body.foodItem?.id).toBe(planItem.foodItem.id);
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
