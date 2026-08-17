import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import type {
  AuthResponse,
  NutritionSummaryDay,
} from '@meal-planning/shared-types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { NUTRITION_API_CLIENT } from './../src/nutrition/clients/nutrition-api-client.interface';
import { FakeNutritionApiClient } from './../src/nutrition/testing/fake-nutrition-api-client';

describe('Analytics: nutrition summary (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const email = `analytics-e2e-${randomUUID()}@example.com`;
  let accessToken: string;
  const today = new Date().toISOString().slice(0, 10);

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

  function auth() {
    return { Authorization: `Bearer ${accessToken}` };
  }

  it('rejects requests without a valid access token', async () => {
    await request(app.getHttpServer())
      .get('/analytics/nutrition-summary')
      .expect(401);
  });

  it('defaults to a 14-day range including today, all zeros/nulls for a fresh user', async () => {
    const res = await request(app.getHttpServer())
      .get('/analytics/nutrition-summary')
      .set(auth())
      .expect(200);
    const days = res.body as NutritionSummaryDay[];

    expect(days).toHaveLength(14);
    expect(days[days.length - 1].date).toBe(today);
    for (const day of days) {
      expect(day.actualCalories).toBe(0);
      expect(day.plannedCalories).toBeNull();
    }
  });

  it('sums same-day manual entries into actualCalories/actualProteinG/etc', async () => {
    await request(app.getHttpServer())
      .post('/logs/nutrition')
      .set(auth())
      .send({
        source: 'manual',
        calories: 300,
        proteinG: 20,
        carbsG: 30,
        fatG: 10,
      })
      .expect(201);
    await request(app.getHttpServer())
      .post('/logs/nutrition')
      .set(auth())
      .send({
        source: 'manual',
        calories: 200,
        proteinG: 10,
        carbsG: 20,
        fatG: 5,
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/analytics/nutrition-summary')
      .set(auth())
      .expect(200);
    const days = res.body as NutritionSummaryDay[];
    const todayEntry = days.find((d) => d.date === today)!;

    expect(todayEntry.actualCalories).toBe(500);
    expect(todayEntry.actualProteinG).toBe(30);
    expect(todayEntry.actualCarbsG).toBe(50);
    expect(todayEntry.actualFatG).toBe(15);
  });

  it("surfaces today's generated meal plan as the planned totals", async () => {
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
    const plan = planRes.body as {
      calorieTarget: number;
      proteinTargetG: number;
    };

    const res = await request(app.getHttpServer())
      .get('/analytics/nutrition-summary')
      .set(auth())
      .expect(200);
    const days = res.body as NutritionSummaryDay[];
    const todayEntry = days.find((d) => d.date === today)!;

    expect(todayEntry.plannedCalories).toBe(plan.calorieTarget);
    expect(todayEntry.plannedProteinG).toBe(plan.proteinTargetG);
  });

  it('uses the most-recently-generated plan when multiple exist for the same day', async () => {
    const secondPlanRes = await request(app.getHttpServer())
      .post('/meal-plans/generate')
      .set(auth())
      .send({})
      .expect(201);
    const secondPlan = secondPlanRes.body as { calorieTarget: number };

    const res = await request(app.getHttpServer())
      .get('/analytics/nutrition-summary')
      .set(auth())
      .expect(200);
    const days = res.body as NutritionSummaryDay[];
    const todayEntry = days.find((d) => d.date === today)!;

    expect(todayEntry.plannedCalories).toBe(secondPlan.calorieTarget);
  });

  it('respects an explicit from/to range', async () => {
    const res = await request(app.getHttpServer())
      .get(`/analytics/nutrition-summary?from=${today}&to=${today}`)
      .set(auth())
      .expect(200);
    const days = res.body as NutritionSummaryDay[];

    expect(days).toHaveLength(1);
    expect(days[0].date).toBe(today);
  });
});
