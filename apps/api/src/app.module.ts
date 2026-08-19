import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ProfileModule } from './profile/profile.module';
import { LogsModule } from './logs/logs.module';
import { NutritionModule } from './nutrition/nutrition.module';
import { MealPlansModule } from './meal-plans/meal-plans.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { RecipesModule } from './recipes/recipes.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    RedisModule,
    HealthModule,
    UsersModule,
    AuthModule,
    ProfileModule,
    LogsModule,
    NutritionModule,
    MealPlansModule,
    AnalyticsModule,
    RecipesModule,
  ],
})
export class AppModule {}
