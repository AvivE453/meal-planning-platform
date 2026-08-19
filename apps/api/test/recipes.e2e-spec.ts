import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import type { AuthResponse, Recipe } from '@meal-planning/shared-types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Recipes (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const email = `recipes-e2e-${randomUUID()}@example.com`;
  let accessToken: string;
  let eggFoodItemId: number;
  let spinachFoodItemId: number;

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

    const eggName = `Egg, large ${randomUUID()}`;
    const egg = await prisma.foodItem.create({
      data: {
        name: eggName,
        category: 'Protein',
        calories: 72,
        proteinG: 6.3,
        carbsG: 0.4,
        fatG: 4.8,
        saturatedFatG: 1.6,
        sugarG: 0.2,
        sodiumMg: 71,
        baseUnit: '1 large egg',
        defaultServingWeightGrams: 50,
      },
    });
    eggFoodItemId = egg.foodId;

    const spinachName = `Spinach ${randomUUID()}`;
    const spinach = await prisma.foodItem.create({
      data: {
        name: spinachName,
        category: 'Vegetable',
        calories: 23,
        proteinG: 2.9,
        carbsG: 3.6,
        fatG: 0.4,
        saturatedFatG: 0.1,
        sugarG: 0.4,
        sodiumMg: 79,
        baseUnit: '100g',
        defaultServingWeightGrams: 100,
      },
    });
    spinachFoodItemId = spinach.foodId;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.foodItem.deleteMany({
      where: { foodId: { in: [eggFoodItemId, spinachFoodItemId] } },
    });
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${accessToken}` });

  it('rejects requests without a valid access token', async () => {
    await request(app.getHttpServer()).post('/recipes').expect(401);
    await request(app.getHttpServer()).get('/recipes').expect(401);
  });

  let recipeId: string;

  it('creates a recipe from existing food_items rows with correct aggregate nutrition', async () => {
    const res = await request(app.getHttpServer())
      .post('/recipes')
      .set(auth())
      .send({
        name: 'Egg and Spinach Scramble',
        mealSlot: 'breakfast',
        ingredients: [
          { foodItemId: eggFoodItemId, amount: 2 }, // 2 large eggs
          { foodItemId: spinachFoodItemId, amount: 0.5 }, // 50g spinach
        ],
      })
      .expect(201);

    const recipe = res.body as Recipe;
    recipeId = recipe.id;
    expect(recipe.name).toBe('Egg and Spinach Scramble');
    expect(recipe.mealSlot).toBe('breakfast');
    expect(recipe.ingredients).toHaveLength(2);
    expect(recipe.ingredients[0].amount).toBe(2);
    expect(recipe.ingredients[0].foodItem.name).toContain('Egg, large');
    // 72*2 + 23*0.5 = 144 + 11.5 = 155.5
    expect(recipe.calories).toBeCloseTo(155.5, 5);
    expect(recipe.proteinG).toBeCloseTo(6.3 * 2 + 2.9 * 0.5, 5);
  });

  it('reuses the same food_items row across recipes rather than duplicating it', async () => {
    const before = await prisma.foodItem.count({
      where: { foodId: eggFoodItemId },
    });

    await request(app.getHttpServer())
      .post('/recipes')
      .set(auth())
      .send({
        name: 'Just Eggs',
        mealSlot: 'breakfast',
        ingredients: [{ foodItemId: eggFoodItemId, amount: 3 }],
      })
      .expect(201);

    const after = await prisma.foodItem.count({
      where: { foodId: eggFoodItemId },
    });
    expect(after).toBe(before);
  });

  it('404s for an ingredient referencing a food item that does not exist', async () => {
    await request(app.getHttpServer())
      .post('/recipes')
      .set(auth())
      .send({
        name: 'Bad Recipe',
        mealSlot: 'lunch',
        ingredients: [{ foodItemId: 999999999, amount: 1 }],
      })
      .expect(404);
  });

  it('rejects an ingredient with no foodItemId', async () => {
    await request(app.getHttpServer())
      .post('/recipes')
      .set(auth())
      .send({
        name: 'Bad Recipe',
        mealSlot: 'lunch',
        ingredients: [{ amount: 1 }],
      })
      .expect(400);
  });

  it('rejects a recipe with no mealSlot', async () => {
    await request(app.getHttpServer())
      .post('/recipes')
      .set(auth())
      .send({
        name: 'No Meal Slot',
        ingredients: [{ foodItemId: eggFoodItemId, amount: 1 }],
      })
      .expect(400);
  });

  it('rejects a recipe with an invalid mealSlot', async () => {
    await request(app.getHttpServer())
      .post('/recipes')
      .set(auth())
      .send({
        name: 'Bad Meal Slot',
        mealSlot: 'brunch',
        ingredients: [{ foodItemId: eggFoodItemId, amount: 1 }],
      })
      .expect(400);
  });

  it("lists all of the current user's recipes", async () => {
    const res = await request(app.getHttpServer())
      .get('/recipes')
      .set(auth())
      .expect(200);
    const recipes = res.body as Recipe[];
    expect(recipes.length).toBeGreaterThanOrEqual(2);
    expect(recipes.some((r) => r.id === recipeId)).toBe(true);
  });

  it('finds a recipe by a partial, case-insensitive name match', async () => {
    const res = await request(app.getHttpServer())
      .get('/recipes?q=spinach')
      .set(auth())
      .expect(200);
    const recipes = res.body as Recipe[];
    expect(recipes.map((r) => r.id)).toContain(recipeId);
  });

  it('returns an empty list for a name search that matches nothing', async () => {
    const res = await request(app.getHttpServer())
      .get('/recipes?q=spaghetti')
      .set(auth())
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it('gets a single recipe by id', async () => {
    const res = await request(app.getHttpServer())
      .get(`/recipes/${recipeId}`)
      .set(auth())
      .expect(200);
    expect((res.body as Recipe).id).toBe(recipeId);
  });

  it('404s for a recipe that does not exist', async () => {
    await request(app.getHttpServer())
      .get(`/recipes/${randomUUID()}`)
      .set(auth())
      .expect(404);
  });

  describe('cross-user isolation', () => {
    const otherEmail = `recipes-e2e-other-${randomUUID()}@example.com`;
    let otherToken: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: otherEmail, password: 'password123' })
        .expect(201);
      otherToken = (res.body as AuthResponse).accessToken;
    });

    afterAll(async () => {
      await prisma.user.deleteMany({ where: { email: otherEmail } });
    });

    it("403s trying to view another user's recipe", async () => {
      await request(app.getHttpServer())
        .get(`/recipes/${recipeId}`)
        .set({ Authorization: `Bearer ${otherToken}` })
        .expect(403);
    });

    it("403s trying to delete another user's recipe", async () => {
      await request(app.getHttpServer())
        .delete(`/recipes/${recipeId}`)
        .set({ Authorization: `Bearer ${otherToken}` })
        .expect(403);
    });

    it("doesn't see another user's recipe in their own list", async () => {
      const res = await request(app.getHttpServer())
        .get('/recipes')
        .set({ Authorization: `Bearer ${otherToken}` })
        .expect(200);
      expect((res.body as Recipe[]).some((r) => r.id === recipeId)).toBe(false);
    });
  });

  it('deletes a recipe', async () => {
    await request(app.getHttpServer())
      .delete(`/recipes/${recipeId}`)
      .set(auth())
      .expect(204);

    await request(app.getHttpServer())
      .get(`/recipes/${recipeId}`)
      .set(auth())
      .expect(404);
  });
});
