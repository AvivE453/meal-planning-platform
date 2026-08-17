import { Injectable } from '@nestjs/common';
import type { UserProfile } from '@meal-planning/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import type { UserProfile as PrismaUserProfile } from '../../generated/prisma/client';
import type { UpsertProfileDto } from './dto/upsert-profile.dto';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(userId: string, dto: UpsertProfileDto): Promise<UserProfile> {
    const profile = await this.prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        sex: dto.sex,
        dateOfBirth: new Date(dto.dateOfBirth),
        heightCm: dto.heightCm,
        activityLevel: dto.activityLevel,
        goal: dto.goal,
        targetWeightKg: dto.targetWeightKg,
        weeklyRateKg: dto.weeklyRateKg,
      },
      update: {
        sex: dto.sex,
        dateOfBirth: new Date(dto.dateOfBirth),
        heightCm: dto.heightCm,
        activityLevel: dto.activityLevel,
        goal: dto.goal,
        targetWeightKg: dto.targetWeightKg ?? null,
        weeklyRateKg: dto.weeklyRateKg ?? null,
      },
    });
    return toUserProfile(profile);
  }

  async findByUserId(userId: string): Promise<UserProfile | null> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
    });
    return profile ? toUserProfile(profile) : null;
  }
}

function toUserProfile(profile: PrismaUserProfile): UserProfile {
  return {
    userId: profile.userId,
    sex: profile.sex,
    dateOfBirth: profile.dateOfBirth.toISOString().slice(0, 10),
    heightCm: Number(profile.heightCm),
    activityLevel: profile.activityLevel,
    goal: profile.goal,
    targetWeightKg:
      profile.targetWeightKg !== null ? Number(profile.targetWeightKg) : null,
    weeklyRateKg:
      profile.weeklyRateKg !== null ? Number(profile.weeklyRateKg) : null,
    updatedAt: profile.updatedAt.toISOString(),
  };
}
