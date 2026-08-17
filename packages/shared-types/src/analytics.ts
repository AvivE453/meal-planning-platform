/**
 * One calendar day's actual-vs-planned nutrition. "Actual" sums that day's
 * daily_nutrition_logs; "planned" comes from that day's most-recently-generated
 * MealPlan, if one exists — null fields mean no plan was generated for that day,
 * not zero targets.
 */
export interface NutritionSummaryDay {
  date: string;
  actualCalories: number;
  actualProteinG: number;
  actualCarbsG: number;
  actualFatG: number;
  plannedCalories: number | null;
  plannedProteinG: number | null;
  plannedCarbsG: number | null;
  plannedFatG: number | null;
}
