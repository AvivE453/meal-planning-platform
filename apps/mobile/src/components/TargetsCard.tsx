import { StyleSheet, Text, View } from 'react-native';
import type { NutritionTargets } from '@meal-planning/shared-types';

export function TargetsCard({ targets }: { targets: NutritionTargets | null }) {
  if (!targets) {
    return <Text style={styles.hint}>Log your weight to see your daily targets.</Text>;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.primary}>{Math.round(targets.calorieTarget)} kcal/day</Text>
      <View style={styles.macros}>
        <Text style={styles.macro}>{Math.round(targets.macroTargets.proteinG)}g protein</Text>
        <Text style={styles.macro}>{Math.round(targets.macroTargets.carbsG)}g carbs</Text>
        <Text style={styles.macro}>{Math.round(targets.macroTargets.fatG)}g fat</Text>
      </View>
      <Text style={styles.hint}>
        TDEE {Math.round(targets.tdee)} kcal · goal: {targets.goal.replace('_', ' ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: '#666', textAlign: 'center' },
  card: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, alignItems: 'center', gap: 4 },
  primary: { fontSize: 22, fontWeight: '700' },
  macros: { flexDirection: 'row', gap: 10 },
  macro: { fontSize: 13, color: '#444' },
});
