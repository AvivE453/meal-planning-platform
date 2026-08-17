import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DietaryRestriction } from '@meal-planning/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import type { DietaryRestriction as PrismaDietaryRestriction } from '../../generated/prisma/client';
import type { CreateRestrictionDto } from './dto/create-restriction.dto';

@Injectable()
export class RestrictionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    dto: CreateRestrictionDto,
  ): Promise<DietaryRestriction> {
    const restriction = await this.prisma.dietaryRestriction.create({
      data: { userId, type: dto.type, value: dto.value },
    });
    return toDietaryRestriction(restriction);
  }

  async findAllByUserId(userId: string): Promise<DietaryRestriction[]> {
    const restrictions = await this.prisma.dietaryRestriction.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return restrictions.map(toDietaryRestriction);
  }

  async remove(userId: string, id: string): Promise<void> {
    const restriction = await this.prisma.dietaryRestriction.findUnique({
      where: { id },
    });
    if (!restriction) {
      throw new NotFoundException('Restriction not found');
    }
    if (restriction.userId !== userId) {
      throw new ForbiddenException();
    }
    await this.prisma.dietaryRestriction.delete({ where: { id } });
  }
}

function toDietaryRestriction(
  restriction: PrismaDietaryRestriction,
): DietaryRestriction {
  return {
    id: restriction.id,
    userId: restriction.userId,
    type: restriction.type,
    value: restriction.value,
    createdAt: restriction.createdAt.toISOString(),
  };
}
