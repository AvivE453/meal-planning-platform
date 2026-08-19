import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import type {
  AuthResponse,
  FoodItem,
  NutrientBreakdown,
} from '@meal-planning/shared-types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { NUTRITION_API_CLIENT } from './../src/nutrition/clients/nutrition-api-client.interface';
import { FakeNutritionApiClient } from './../src/nutrition/testing/fake-nutrition-api-client';

describe('Nutrition (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let fakeClient: FakeNutritionApiClient;
  const email = `nutrition-e2e-${randomUUID()}@example.com`;
  let accessToken: string;
  const seededFoodIds: number[] = [];

  beforeAll(async () => {
    // Still overridden — getNutrients() still calls the live client (that
    // integration deliberately stays wired up), only search() no longer does.
    fakeClient = new FakeNutritionApiClient();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(NUTRITION_API_CLIENT)
      .useValue(fakeClient)
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
    // food_items has no per-user FK to cascade-delete from — it's a shared,
    // permanent dataset, so anything this file seeds must be cleaned up
    // explicitly.
    if (seededFoodIds.length > 0) {
      await prisma.foodItem.deleteMany({
        where: { foodId: { in: seededFoodIds } },
      });
    }
    await app.close();
  });

  it('rejects search without a valid access token', async () => {
    await request(app.getHttpServer())
      .get('/foods/search?q=chicken')
      .expect(401);
  });

  it('rejects a search with no query', async () => {
    await request(app.getHttpServer())
      .get('/foods/search')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);
  });

  describe('search — local-only, food_items is the sole source', () => {
    it('returns rows matching the query, case-insensitively, without ever calling the live client', async () => {
      const probeTerm = `probe-${randomUUID()}`;
      const row = await prisma.foodItem.create({
        data: {
          name: `${probeTerm} Item`,
          category: 'Vegetable',
          calories: 100,
          proteinG: 10,
          carbsG: 10,
          fatG: 5,
          saturatedFatG: 1,
          sugarG: 0,
          sodiumMg: 0,
          baseUnit: '100g',
          defaultServingWeightGrams: 100,
        },
      });
      seededFoodIds.push(row.foodId);

      const callsBefore = fakeClient.calls.length;
      const res = await request(app.getHttpServer())
        .get(`/foods/search?q=${encodeURIComponent(probeTerm.toUpperCase())}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = res.body as FoodItem[];
      expect(body.some((item) => item.id === String(row.foodId))).toBe(true);
      expect(fakeClient.calls.length).toBe(callsBefore);
    });

    it('returns an empty array for a term with no local matches, not an error', async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/foods/search?q=${encodeURIComponent(`no-such-food-${randomUUID()}`)}`,
        )
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toEqual([]);
    });
  });

  it('rejects a nutrients lookup without a valid access token', async () => {
    await request(app.getHttpServer())
      .get(
        '/foods/food_fake_chicken/nutrients?measureUri=edamam.owl%23Measure_serving',
      )
      .expect(401);
  });

  it('rejects a nutrients lookup with no measureUri', async () => {
    await request(app.getHttpServer())
      .get('/foods/food_fake_chicken/nutrients')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);
  });

  it('returns a full nutrient breakdown built by the real Adapter over the fake client response', async () => {
    const res = await request(app.getHttpServer())
      .get(
        '/foods/food_fake_chicken/nutrients?measureUri=edamam.owl%23Measure_serving&quantity=2',
      )
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = res.body as NutrientBreakdown;
    expect(body).toEqual({
      calories: 326.4,
      proteinG: 61.2,
      carbsG: 0,
      fatG: 7.13,
      saturatedFatG: 2.03,
      sugarG: 2.5,
      sodiumMg: 122.4,
    });
    expect(fakeClient.nutrientCalls).toContainEqual({
      foodId: 'food_fake_chicken',
      measureUri: 'edamam.owl#Measure_serving',
      quantity: 2,
    });
  });

  it('defaults quantity to 1 when not provided', async () => {
    await request(app.getHttpServer())
      .get(
        '/foods/food_fake_chicken/nutrients?measureUri=edamam.owl%23Measure_serving',
      )
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(fakeClient.nutrientCalls).toContainEqual({
      foodId: 'food_fake_chicken',
      measureUri: 'edamam.owl#Measure_serving',
      quantity: 1,
    });
  });
});
