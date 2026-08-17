import { StyleSheet, Text, View } from 'react-native';
import type { WeightLog } from '@meal-planning/shared-types';

export function WeightLogList({ logs }: { logs: WeightLog[] }) {
  if (logs.length === 0) {
    return <Text style={styles.hint}>No weight logged yet.</Text>;
  }

  return (
    <View style={styles.list}>
      {logs.map((log) => (
        <View key={log.id} style={styles.row}>
          <Text>{log.weightKg} kg</Text>
          <Text style={styles.date}>{new Date(log.loggedAt).toLocaleDateString()}</Text>
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
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  date: { color: '#666', fontSize: 13 },
});
