import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Put,
  UseGuards,
} from '@nestjs/common';
import type {
  AuthenticatedUser,
  UserProfile,
} from '@meal-planning/shared-types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpsertProfileDto } from './dto/upsert-profile.dto';
import { ProfileService } from './profile.service';

@Controller('users/me/profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Put()
  upsert(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertProfileDto,
  ): Promise<UserProfile> {
    return this.profileService.upsert(user.id, dto);
  }

  @Get()
  async get(@CurrentUser() user: AuthenticatedUser): Promise<UserProfile> {
    const profile = await this.profileService.findByUserId(user.id);
    if (!profile) {
      throw new NotFoundException('Profile not set up yet');
    }
    return profile;
  }
}
