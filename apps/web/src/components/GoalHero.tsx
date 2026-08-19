import type { Goal, NutritionTargets } from '@meal-planning/shared-types';

const GOAL_LABELS: Record<Goal, string> = {
  weight_loss: 'Weight Loss',
  weight_gain: 'Weight Gain',
  maintenance: 'Maintenance',
};

const GOAL_ORDER: Goal[] = ['weight_loss', 'maintenance', 'weight_gain'];

export function GoalHero({
  goal,
  targets,
  isChanging = false,
  onChangeGoal,
}: {
  goal: Goal;
  targets: NutritionTargets | null;
  isChanging?: boolean;
  /** Omit to render a read-only panel — the switch buttons only show up when this is passed. */
  onChangeGoal?: (goal: Goal) => void;
}) {
  return (
    <div className="goal-hero">
      <span className="goal-hero-label">Your plan</span>
      <span className="goal-hero-goal">{GOAL_LABELS[goal]}</span>

      {targets ? (
        <span className="goal-hero-kcal">
          {Math.round(targets.calorieTarget)}
          <span className="goal-hero-kcal-unit"> kcal/day</span>
        </span>
      ) : (
        <span className="goal-hero-hint">Log your weight to see your daily targets.</span>
      )}

      {onChangeGoal && (
        <div className="goal-hero-switch">
          {GOAL_ORDER.map((option) => (
            <button
              key={option}
              type="button"
              className={option === goal ? 'goal-hero-option active' : 'goal-hero-option'}
              disabled={isChanging}
              onClick={() => onChangeGoal(option)}
            >
              {GOAL_LABELS[option]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
