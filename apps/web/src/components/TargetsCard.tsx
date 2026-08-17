import type { NutritionTargets } from '@meal-planning/shared-types';

export function TargetsCard({ targets }: { targets: NutritionTargets | null }) {
  if (!targets) {
    return <p className="field-hint">Log your weight to see your daily targets.</p>;
  }

  return (
    <div className="targets-card">
      <div className="targets-primary">{Math.round(targets.calorieTarget)} kcal/day</div>
      <div className="targets-macros">
        <span>{Math.round(targets.macroTargets.proteinG)}g protein</span>
        <span>{Math.round(targets.macroTargets.carbsG)}g carbs</span>
        <span>{Math.round(targets.macroTargets.fatG)}g fat</span>
      </div>
      <div className="field-hint">TDEE {Math.round(targets.tdee)} kcal · goal: {targets.goal.replace('_', ' ')}</div>
    </div>
  );
}
