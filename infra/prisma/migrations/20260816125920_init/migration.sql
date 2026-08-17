-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('male', 'female');

-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('sedentary', 'light', 'moderate', 'active', 'very_active');

-- CreateEnum
CREATE TYPE "Goal" AS ENUM ('weight_loss', 'weight_gain', 'maintenance');

-- CreateEnum
CREATE TYPE "RestrictionType" AS ENUM ('allergy', 'intolerance', 'preference');

-- CreateEnum
CREATE TYPE "FoodSource" AS ENUM ('edamam', 'usda');

-- CreateEnum
CREATE TYPE "MealSlot" AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');

-- CreateEnum
CREATE TYPE "MealPlanStatus" AS ENUM ('draft', 'active', 'completed');

-- CreateEnum
CREATE TYPE "ActivityIntensity" AS ENUM ('low', 'moderate', 'high');

-- CreateEnum
CREATE TYPE "NutritionLogSource" AS ENUM ('meal_plan', 'manual', 'search');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "user_id" TEXT NOT NULL,
    "sex" "Sex" NOT NULL,
    "date_of_birth" DATE NOT NULL,
    "height_cm" DECIMAL(65,30) NOT NULL,
    "activity_level" "ActivityLevel" NOT NULL,
    "goal" "Goal" NOT NULL,
    "target_weight_kg" DECIMAL(65,30),
    "weekly_rate_kg" DECIMAL(65,30),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "dietary_restrictions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "RestrictionType" NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dietary_restrictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weight_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "weight_kg" DECIMAL(65,30) NOT NULL,
    "logged_at" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weight_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "activity_type" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "calories_burned" DECIMAL(65,30),
    "intensity" "ActivityIntensity" NOT NULL,
    "logged_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_items" (
    "id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "source" "FoodSource" NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "calories" DECIMAL(65,30) NOT NULL,
    "protein_g" DECIMAL(65,30) NOT NULL,
    "carbs_g" DECIMAL(65,30) NOT NULL,
    "fat_g" DECIMAL(65,30) NOT NULL,
    "sugar_g" DECIMAL(65,30) NOT NULL,
    "sodium_mg" DECIMAL(65,30) NOT NULL,
    "serving_qty" DECIMAL(65,30) NOT NULL,
    "serving_unit" TEXT NOT NULL,
    "raw_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "food_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_plans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "goal_snapshot" "Goal" NOT NULL,
    "calorie_target" DECIMAL(65,30) NOT NULL,
    "protein_target_g" DECIMAL(65,30) NOT NULL,
    "carbs_target_g" DECIMAL(65,30) NOT NULL,
    "fat_target_g" DECIMAL(65,30) NOT NULL,
    "status" "MealPlanStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meal_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_plan_items" (
    "id" TEXT NOT NULL,
    "meal_plan_id" TEXT NOT NULL,
    "food_item_id" TEXT NOT NULL,
    "meal_slot" "MealSlot" NOT NULL,
    "servings" DECIMAL(65,30) NOT NULL,
    "calories" DECIMAL(65,30) NOT NULL,
    "protein_g" DECIMAL(65,30) NOT NULL,
    "carbs_g" DECIMAL(65,30) NOT NULL,
    "fat_g" DECIMAL(65,30) NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "meal_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_nutrition_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "food_item_id" TEXT,
    "meal_plan_item_id" TEXT,
    "servings" DECIMAL(65,30) NOT NULL,
    "calories" DECIMAL(65,30) NOT NULL,
    "protein_g" DECIMAL(65,30) NOT NULL,
    "carbs_g" DECIMAL(65,30) NOT NULL,
    "fat_g" DECIMAL(65,30) NOT NULL,
    "source" "NutritionLogSource" NOT NULL,
    "logged_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_nutrition_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "dietary_restrictions_user_id_idx" ON "dietary_restrictions"("user_id");

-- CreateIndex
CREATE INDEX "weight_logs_user_id_logged_at_idx" ON "weight_logs"("user_id", "logged_at");

-- CreateIndex
CREATE INDEX "activity_logs_user_id_logged_at_idx" ON "activity_logs"("user_id", "logged_at");

-- CreateIndex
CREATE UNIQUE INDEX "food_items_source_external_id_key" ON "food_items"("source", "external_id");

-- CreateIndex
CREATE INDEX "meal_plans_user_id_date_idx" ON "meal_plans"("user_id", "date");

-- CreateIndex
CREATE INDEX "meal_plan_items_meal_plan_id_idx" ON "meal_plan_items"("meal_plan_id");

-- CreateIndex
CREATE INDEX "daily_nutrition_logs_user_id_date_idx" ON "daily_nutrition_logs"("user_id", "date");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dietary_restrictions" ADD CONSTRAINT "dietary_restrictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weight_logs" ADD CONSTRAINT "weight_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_items" ADD CONSTRAINT "meal_plan_items_meal_plan_id_fkey" FOREIGN KEY ("meal_plan_id") REFERENCES "meal_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_items" ADD CONSTRAINT "meal_plan_items_food_item_id_fkey" FOREIGN KEY ("food_item_id") REFERENCES "food_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_nutrition_logs" ADD CONSTRAINT "daily_nutrition_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_nutrition_logs" ADD CONSTRAINT "daily_nutrition_logs_food_item_id_fkey" FOREIGN KEY ("food_item_id") REFERENCES "food_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_nutrition_logs" ADD CONSTRAINT "daily_nutrition_logs_meal_plan_item_id_fkey" FOREIGN KEY ("meal_plan_item_id") REFERENCES "meal_plan_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
