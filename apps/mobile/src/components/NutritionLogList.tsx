import { StyleSheet, Text, View } from 'react-native';
import type { DailyNutritionLog } from '@meal-planning/shared-types';

function describe(log: DailyNutritionLog): string {
  if (log.foodItem) {
    return `${log.foodItem.name} × ${log.servings}`;
  }
  return 'Manual entry';
}

export function NutritionLogList({ logs }: { logs: DailyNutritionLog[] }) {
  if (logs.length === 0) {
    return <Text style={styles.hint}>Nothing logged yet.</Text>;
  }

  return (
    <View style={styles.list}>
      {logs.map((log) => (
        <View key={log.id} style={styles.row}>
          <Text style={styles.description}>{describe(log)}</Text>
          <Text style={styles.date}>
            {Math.round(log.calories)} kcal · {new Date(log.loggedAt).toLocaleDateString()}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: '#666' },
  list: { width: '100%' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  description: { flexShrink: 1 },
  date: { color: '#666', fontSize: 13 },
});
