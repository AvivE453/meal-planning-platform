-- AlterTable
ALTER TABLE "recipes" ADD COLUMN     "meal_slot" "MealSlot" NOT NULL DEFAULT 'lunch';

-- CreateIndex
CREATE INDEX "recipes_user_id_meal_slot_idx" ON "recipes"("user_id", "meal_slot");
