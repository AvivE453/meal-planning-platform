import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import type { AuthResponse } from '@meal-planning/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { hashToken } from './token-hash.util';
import type { JwtPayload } from './types/jwt-payload.type';

const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_BYTES = 32;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly refreshTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    const days = Number(config.get<string>('REFRESH_TOKEN_TTL_DAYS') ?? 30);
    this.refreshTtlMs = days * MS_PER_DAY;
  }

  async register(email: string, password: string): Promise<AuthResponse> {
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email is already registered');
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await this.users.create(email, passwordHash);
    return this.issueTokens(user.id, user.email);
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const user = await this.users.findByEmail(email);
    const passwordMatches = user
      ? await bcrypt.compare(password, user.passwordHash)
      : false;
    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issueTokens(user.id, user.email);
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash: hashToken(refreshToken),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    const user = stored ? await this.users.findById(stored.userId) : null;
    if (!stored || !user) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate: the presented token is single-use, whether or not it was already
    // near expiry — bounds replay risk if a refresh token is ever leaked.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(user.id, user.email);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(
    userId: string,
    email: string,
  ): Promise<AuthResponse> {
    const payload: JwtPayload = { sub: userId, email };
    const accessToken = this.jwt.sign(payload);

    const refreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
      },
    });

    return { accessToken, refreshToken, user: { id: userId, email } };
  }
}
