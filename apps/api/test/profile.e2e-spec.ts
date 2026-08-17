import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import type {
  ActivityLog,
  AuthResponse,
  DietaryRestriction,
  NutritionTargets,
  UserProfile,
  WeightLog,
} from '@meal-planning/shared-types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { RedisService } from './../src/redis/redis.service';
import { targetsCacheKey } from './../src/profile/targets.service';

describe('Profile / restrictions / logs / targets (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let redis: RedisService;
  const email = `profile-e2e-${randomUUID()}@example.com`;
  let accessToken: string;
  let userId: string;

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
    redis = app.get(RedisService);

    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);
    const body = registerRes.body as AuthResponse;
    accessToken = body.accessToken;
    userId = body.user.id;
  });

  afterAll(async () => {
    await redis.del(targetsCacheKey(userId));
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${accessToken}` });

  it('returns 404 for a profile that has not been set up yet', async () => {
    await request(app.getHttpServer())
      .get('/users/me/profile')
      .set(auth())
      .expect(404);
  });

  it('creates a profile via PUT (upsert)', async () => {
    const res = await request(app.getHttpServer())
      .put('/users/me/profile')
      .set(auth())
      .send({
        sex: 'male',
        dateOfBirth: '1995-06-15',
        heightCm: 180,
        activityLevel: 'moderate',
        goal: 'weight_loss',
      })
      .expect(200);

    const body = res.body as UserProfile;
    expect(body.heightCm).toBe(180);
    expect(body.goal).toBe('weight_loss');
    expect(body.weeklyRateKg).toBeNull();
  });

  it('rejects an invalid profile payload', async () => {
    await request(app.getHttpServer())
      .put('/users/me/profile')
      .set(auth())
      .send({
        sex: 'unknown',
        dateOfBirth: '1995-06-15',
        heightCm: 180,
        activityLevel: 'moderate',
        goal: 'weight_loss',
      })
      .expect(400);
  });

  it('returns the profile via GET after it has been set up', async () => {
    const res = await request(app.getHttpServer())
      .get('/users/me/profile')
      .set(auth())
      .expect(200);
    expect((res.body as UserProfile).sex).toBe('male');
  });

  it('returns 404 for targets before any weight has been logged', async () => {
    await request(app.getHttpServer())
      .get('/users/me/targets')
      .set(auth())
      .expect(404);
  });

  let weightLogId: string;

  it('logs a weight entry', async () => {
    const res = await request(app.getHttpServer())
      .post('/logs/weight')
      .set(auth())
      .send({ weightKg: 82.5, note: 'morning weigh-in' })
      .expect(201);

    const body = res.body as WeightLog;
    expect(body.weightKg).toBe(82.5);
    weightLogId = body.id;
  });

  it('lists the logged weight entry', async () => {
    const res = await request(app.getHttpServer())
      .get('/logs/weight')
      .set(auth())
      .expect(200);
    const body = res.body as WeightLog[];
    expect(body.some((log) => log.id === weightLogId)).toBe(true);
  });

  it('computes nutrition targets from the profile + latest weight once both exist', async () => {
    const res = await request(app.getHttpServer())
      .get('/users/me/targets')
      .set(auth())
      .expect(200);
    const body = res.body as NutritionTargets;

    expect(body.goal).toBe('weight_loss');
    expect(body.tdee).toBeGreaterThan(0);
    // Weight-loss strategy subtracts a deficit from TDEE.
    expect(body.calorieTarget).toBeLessThan(body.tdee);
    expect(body.macroTargets.proteinG).toBeGreaterThan(0);
  });

  it('caches targets in Redis, then invalidates them via the weight.logged event (Observer)', async () => {
    const key = targetsCacheKey(userId);

    const firstRes = await request(app.getHttpServer())
      .get('/users/me/targets')
      .set(auth())
      .expect(200);
    const firstTargets = firstRes.body as NutritionTargets;

    const cachedRaw = await redis.get(key);
    expect(cachedRaw).not.toBeNull();
    expect(JSON.parse(cachedRaw!)).toEqual(firstTargets);

    // A meaningfully different weight -> a different TDEE -> different
    // targets, so the recomputed values below prove a real recompute
    // happened rather than a coincidentally-identical stale cache hit.
    await request(app.getHttpServer())
      .post('/logs/weight')
      .set(auth())
      .send({ weightKg: 95 })
      .expect(201);

    // weight-logs.service awaits emitAsync before responding, so the listener
    // has already run and the cache is already gone — no polling needed.
    expect(await redis.get(key)).toBeNull();

    const secondRes = await request(app.getHttpServer())
      .get('/users/me/targets')
      .set(auth())
      .expect(200);
    const secondTargets = secondRes.body as NutritionTargets;

    expect(secondTargets.tdee).toBeGreaterThan(firstTargets.tdee);
    expect(secondTargets.calorieTarget).not.toBe(firstTargets.calorieTarget);
    expect(await redis.get(key)).not.toBeNull();
  });

  it('deletes the weight log', async () => {
    await request(app.getHttpServer())
      .delete(`/logs/weight/${weightLogId}`)
      .set(auth())
      .expect(204);
    const res = await request(app.getHttpServer())
      .get('/logs/weight')
      .set(auth())
      .expect(200);
    expect(
      (res.body as WeightLog[]).some((log) => log.id === weightLogId),
    ).toBe(false);
  });

  let restrictionId: string;

  it('adds a dietary restriction', async () => {
    const res = await request(app.getHttpServer())
      .post('/users/me/restrictions')
      .set(auth())
      .send({ type: 'allergy', value: 'peanuts' })
      .expect(201);
    const body = res.body as DietaryRestriction;
    expect(body.value).toBe('peanuts');
    restrictionId = body.id;
  });

  it('lists dietary restrictions', async () => {
    const res = await request(app.getHttpServer())
      .get('/users/me/restrictions')
      .set(auth())
      .expect(200);
    expect(
      (res.body as DietaryRestriction[]).some((r) => r.id === restrictionId),
    ).toBe(true);
  });

  it('removes a dietary restriction', async () => {
    await request(app.getHttpServer())
      .delete(`/users/me/restrictions/${restrictionId}`)
      .set(auth())
      .expect(204);
    const res = await request(app.getHttpServer())
      .get('/users/me/restrictions')
      .set(auth())
      .expect(200);
    expect(
      (res.body as DietaryRestriction[]).some((r) => r.id === restrictionId),
    ).toBe(false);
  });

  it('logs and lists an activity entry', async () => {
    await request(app.getHttpServer())
      .post('/logs/activity')
      .set(auth())
      .send({
        activityType: 'running',
        durationMinutes: 30,
        intensity: 'moderate',
        caloriesBurned: 300,
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/logs/activity')
      .set(auth())
      .expect(200);
    const body = res.body as ActivityLog[];
    expect(
      body.some(
        (log) => log.activityType === 'running' && log.caloriesBurned === 300,
      ),
    ).toBe(true);
  });

  it('rejects logs and profile endpoints without a valid access token', async () => {
    await request(app.getHttpServer()).get('/users/me/profile').expect(401);
    await request(app.getHttpServer()).get('/logs/weight').expect(401);
    await request(app.getHttpServer()).get('/users/me/targets').expect(401);
  });
});
