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

describe('Nutrition search (e2e, real Adapter over a faked network client)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let fakeClient: FakeNutritionApiClient;
  const email = `nutrition-e2e-${randomUUID()}@example.com`;
  let accessToken: string;

  beforeAll(async () => {
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

  it('returns normalized FoodItems built by the real Adapter over the fake client response', async () => {
    const res = await request(app.getHttpServer())
      .get('/foods/search?q=chicken breast')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = res.body as FoodItem[];
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      id: 'food_fake_chicken',
      source: 'edamam',
      name: 'chicken breast (fake result)',
      calories: 165,
      proteinG: 31,
    });
    expect(fakeClient.calls).toContain('chicken breast');
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
