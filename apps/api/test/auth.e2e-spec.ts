import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import type {
  AuthenticatedUser,
  AuthResponse,
} from '@meal-planning/shared-types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const email = `e2e-${randomUUID()}@example.com`;
  const password = 'password123';

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
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('registers a new user and returns a token pair', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password })
      .expect(201);

    const body = res.body as AuthResponse;
    expect(body.user.email).toBe(email);
    expect(typeof body.accessToken).toBe('string');
    expect(typeof body.refreshToken).toBe('string');
  });

  it('rejects a duplicate registration with 409', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password })
      .expect(409);
  });

  it('rejects registration with a too-short password', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `short-${randomUUID()}@example.com`, password: 'short' })
      .expect(400);
  });

  it('rejects login with the wrong password', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);
  });

  let accessToken: string;
  let refreshToken: string;

  it('logs in with correct credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    const body = res.body as AuthResponse;
    accessToken = body.accessToken;
    refreshToken = body.refreshToken;
    expect(accessToken).toEqual(expect.any(String));
  });

  it('rejects GET /users/me without a token', async () => {
    await request(app.getHttpServer()).get('/users/me').expect(401);
  });

  it('returns the current user for a valid access token', async () => {
    const res = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = res.body as AuthenticatedUser;
    expect(body.email).toBe(email);
  });

  it('rotates tokens on refresh and invalidates the previous refresh token', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    const body = res.body as AuthResponse;
    expect(body.refreshToken).not.toBe(refreshToken);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);

    accessToken = body.accessToken;
    refreshToken = body.refreshToken;
  });

  it('logs out and invalidates the refresh token', async () => {
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken })
      .expect(204);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });

  it('rejects logout without a valid access token', async () => {
    await request(app.getHttpServer())
      .post('/auth/logout')
      .send({ refreshToken })
      .expect(401);
  });
});
