import { Test } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    refreshToken: {
      findFirst: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      create: jest.Mock;
    };
  };
  let users: { findByEmail: jest.Mock; findById: jest.Mock; create: jest.Mock };
  let jwt: { sign: jest.Mock };

  beforeEach(async () => {
    prisma = {
      refreshToken: {
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
    };
    users = { findByEmail: jest.fn(), findById: jest.fn(), create: jest.fn() };
    jwt = { sign: jest.fn().mockReturnValue('signed.jwt.token') };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: users },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('register', () => {
    it('throws ConflictException when the email is already registered', async () => {
      users.findByEmail.mockResolvedValue({ id: 'u1', email: 'a@b.com' });

      await expect(service.register('a@b.com', 'password123')).rejects.toThrow(
        ConflictException,
      );
      expect(users.create).not.toHaveBeenCalled();
    });

    it('hashes the password and issues a token pair for a new user', async () => {
      users.findByEmail.mockResolvedValue(null);
      users.create.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register('a@b.com', 'password123');

      const [, passwordHash] = users.create.mock.calls[0] as [string, string];
      expect(passwordHash).not.toBe('password123');
      await expect(bcrypt.compare('password123', passwordHash)).resolves.toBe(
        true,
      );

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(result.user).toEqual({ id: 'u1', email: 'a@b.com' });
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException for an unknown email', async () => {
      users.findByEmail.mockResolvedValue(null);

      await expect(service.login('a@b.com', 'password123')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException for a wrong password', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 4);
      users.findByEmail.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        passwordHash,
      });

      await expect(service.login('a@b.com', 'wrong-password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('issues a token pair for correct credentials', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 4);
      users.findByEmail.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        passwordHash,
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login('a@b.com', 'correct-password');

      expect(result.user).toEqual({ id: 'u1', email: 'a@b.com' });
      expect(result.accessToken).toBe('signed.jwt.token');
    });
  });

  describe('refresh', () => {
    it('throws UnauthorizedException when no matching, live token is found', async () => {
      prisma.refreshToken.findFirst.mockResolvedValue(null);

      await expect(service.refresh('bogus-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rotates the token: revokes the presented one and issues a new pair', async () => {
      prisma.refreshToken.findFirst.mockResolvedValue({
        id: 'rt1',
        userId: 'u1',
      });
      users.findById.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refresh('some-refresh-token');

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt1' },
        data: { revokedAt: expect.any(Date) as Date },
      });
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
      expect(result.user).toEqual({ id: 'u1', email: 'a@b.com' });
    });
  });

  describe('logout', () => {
    it('revokes only the matching, currently-live refresh token', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await service.logout('some-token');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: expect.any(String) as string, revokedAt: null },
        data: { revokedAt: expect.any(Date) as Date },
      });
    });
  });
});
