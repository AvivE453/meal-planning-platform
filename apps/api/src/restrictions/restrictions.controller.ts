import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type {
  AuthenticatedUser,
  DietaryRestriction,
} from '@meal-planning/shared-types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateRestrictionDto } from './dto/create-restriction.dto';
import { RestrictionsService } from './restrictions.service';

@Controller('users/me/restrictions')
@UseGuards(JwtAuthGuard)
export class RestrictionsController {
  constructor(private readonly restrictionsService: RestrictionsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRestrictionDto,
  ): Promise<DietaryRestriction> {
    return this.restrictionsService.create(user.id, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DietaryRestriction[]> {
    return this.restrictionsService.findAllByUserId(user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.restrictionsService.remove(user.id, id);
  }
}
