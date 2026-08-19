-- Redesign food_items into the app's own curated ingredient schema.
-- This is a destructive rebuild (old uuid-keyed rows can't map to the new
-- serial food_id space), acceptable in dev. Any recipe referencing an old
-- food_items row (recipe_ingredients has ON DELETE RESTRICT) is deleted
-- first; meal_plan_items/daily_nutrition_logs references are nulled out
-- (they already use ON DELETE SET NULL for the same case).

-- 1. Clear out everything that would block dropping food_items.
DELETE FROM "recipes"
WHERE "id" IN (
  SELECT DISTINCT "recipe_id" FROM "recipe_ingredients"
);
UPDATE "meal_plan_items" SET "food_item_id" = NULL WHERE "food_item_id" IS NOT NULL;
UPDATE "daily_nutrition_logs" SET "food_item_id" = NULL WHERE "food_item_id" IS NOT NULL;

-- 2. Drop old FKs, old table, old enum.
ALTER TABLE "recipe_ingredients" DROP CONSTRAINT "recipe_ingredients_food_item_id_fkey";
ALTER TABLE "meal_plan_items" DROP CONSTRAINT "meal_plan_items_food_item_id_fkey";
ALTER TABLE "daily_nutrition_logs" DROP CONSTRAINT "daily_nutrition_logs_food_item_id_fkey";

DROP TABLE "food_items";
DROP TYPE "FoodSource";

-- 3. Recreate food_items with the new schema.
CREATE TABLE "food_items" (
    "food_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "calories" DECIMAL(65,30) NOT NULL,
    "protein_g" DECIMAL(65,30) NOT NULL,
    "carbs_g" DECIMAL(65,30) NOT NULL,
    "fat_g" DECIMAL(65,30) NOT NULL,
    "saturated_fat_g" DECIMAL(65,30) NOT NULL,
    "sugar_g" DECIMAL(65,30) NOT NULL,
    "sodium_mg" DECIMAL(65,30) NOT NULL,
    "base_unit" TEXT NOT NULL DEFAULT '100g',
    "default_serving_weight_grams" DECIMAL(65,30) NOT NULL DEFAULT 100,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "food_items_pkey" PRIMARY KEY ("food_id")
);

CREATE UNIQUE INDEX "food_items_name_key" ON "food_items"("name");

-- 4. Retype the FK columns from uuid (text) to int, matching the new PK.
ALTER TABLE "recipe_ingredients" ALTER COLUMN "food_item_id" TYPE INTEGER USING NULL;
ALTER TABLE "meal_plan_items" ALTER COLUMN "food_item_id" TYPE INTEGER USING NULL;
ALTER TABLE "daily_nutrition_logs" ALTER COLUMN "food_item_id" TYPE INTEGER USING NULL;

-- 5. Recreate the FKs against the new table.
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_food_item_id_fkey" FOREIGN KEY ("food_item_id") REFERENCES "food_items"("food_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "meal_plan_items" ADD CONSTRAINT "meal_plan_items_food_item_id_fkey" FOREIGN KEY ("food_item_id") REFERENCES "food_items"("food_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "daily_nutrition_logs" ADD CONSTRAINT "daily_nutrition_logs_food_item_id_fkey" FOREIGN KEY ("food_item_id") REFERENCES "food_items"("food_id") ON DELETE SET NULL ON UPDATE CASCADE;
