import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { DailyNutritionLog, MealPlan, MealSlot } from '@meal-planning/shared-types';
import { ApiError, logsApi, mealPlansApi } from '../api/client';

const SLOT_ORDER: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function MealPlanCard({
  plan,
  onGenerated,
  onLogged,
}: {
  plan: MealPlan | null;
  onGenerated: (plan: MealPlan) => void;
  onLogged: (log: DailyNutritionLog) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [loggedItemIds, setLoggedItemIds] = useState<Set<string>>(new Set());

  const handleGenerate = async () => {
    setError(null);
    setIsGenerating(true);
    try {
      onGenerated(await mealPlansApi.generate());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLogItem = async (mealPlanItemId: string) => {
    setError(null);
    setPendingItemId(mealPlanItemId);
    try {
      const log = await logsApi.nutrition.create({ source: 'meal_plan', mealPlanItemId });
      setLoggedItemIds((prev) => new Set(prev).add(mealPlanItemId));
      onLogged(log);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setPendingItemId(null);
    }
  };

  const totalCalories = plan?.items.reduce((sum, item) => sum + item.calories, 0) ?? 0;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.headerText}>{plan ? `Plan for ${plan.date}` : 'No meal plan yet'}</Text>
        <Pressable style={styles.button} disabled={isGenerating} onPress={() => void handleGenerate()}>
          {isGenerating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{plan ? 'Regenerate' : 'Generate meal plan'}</Text>
          )}
        </Pressable>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {plan && plan.items.length === 0 && (
        <Text style={styles.hint}>No candidates fit your targets this time — try regenerating or adjusting your profile.</Text>
      )}

      {plan && plan.items.length > 0 && (
        <>
          <Text style={styles.totals}>
            {Math.round(totalCalories)} / {Math.round(plan.calorieTarget)} kcal
          </Text>
          {SLOT_ORDER.map((slot) => {
            const items = plan.items.filter((item) => item.mealSlot === slot);
            if (items.length === 0) {
              return null;
            }
            return (
              <View style={styles.slot} key={slot}>
                <Text style={styles.slotTitle}>{capitalize(slot)}</Text>
                {items.map((item) => {
                  const isLogged = loggedItemIds.has(item.id);
                  const isPending = pendingItemId === item.id;
                  return (
                    <View key={item.id} style={styles.itemRow}>
                      <Text style={styles.itemName}>
                        {item.foodItem?.name ?? item.recipe?.name} × {item.servings}
                      </Text>
                      <View style={styles.itemActions}>
                        <Text style={styles.itemCalories}>{Math.round(item.calories)} kcal</Text>
                        <Pressable
                          style={[styles.logItemButton, (isLogged || isPending) && styles.logItemButtonDisabled]}
                          disabled={isLogged || isPending}
                          onPress={() => void handleLogItem(item.id)}
                        >
                          <Text style={styles.logItemButtonText}>
                            {isLogged ? 'Logged' : isPending ? '…' : 'Log'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headerText: { fontWeight: '600', flexShrink: 1 },
  button: {
    backgroundColor: '#1a7f37',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 44,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  error: { color: '#cf222e', marginTop: 8 },
  hint: { fontSize: 12, color: '#666', marginTop: 8 },
  totals: { textAlign: 'center', fontSize: 17, fontWeight: '700', marginTop: 10 },
  slot: { marginTop: 10 },
  slotTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: '#666', letterSpacing: 0.5 },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemName: { fontSize: 14, flexShrink: 1 },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemCalories: { fontSize: 14, color: '#444' },
  logItemButton: {
    borderWidth: 1,
    borderColor: '#1a7f37',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  logItemButtonDisabled: { opacity: 0.6 },
  logItemButtonText: { color: '#1a7f37', fontWeight: '600', fontSize: 11 },
});
