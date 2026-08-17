import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import type { AuthResponse, MealPlan } from '@meal-planning/shared-types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { NUTRITION_API_CLIENT } from './../src/nutrition/clients/nutrition-api-client.interface';
import { FakeNutritionApiClient } from './../src/nutrition/testing/fake-nutrition-api-client';

describe('Meal plan generation (e2e, real Strategy/Optimizer/Builder over a faked network client)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const email = `meal-plans-e2e-${randomUUID()}@example.com`;
  let accessToken: string;

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

  it('generates a plan from real Strategy + Optimizer + Builder logic over fake search results', async () => {
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
    // The fake client returns one food (165kcal/serving) regardless of query text,
    // so every slot resolves to the same candidate — cheap enough that at least
    // one slot's budget share should fit at least a half serving (82.5kcal).
    expect(plan.items.length).toBeGreaterThan(0);
    for (const item of plan.items) {
      expect(item.foodItem.source).toBe('edamam');
      expect(item.servings).toBeGreaterThan(0);
      expect(item.calories).toBeGreaterThan(0);
    }
    // Mirrors MealPlanBuilder's own 15%-over-target invariant — confirms the
    // persisted totals still honor what build() already validated in-memory.
    const totalCalories = plan.items.reduce(
      (sum, item) => sum + item.calories,
      0,
    );
    expect(totalCalories).toBeLessThanOrEqual(plan.calorieTarget * 1.15);
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
});
