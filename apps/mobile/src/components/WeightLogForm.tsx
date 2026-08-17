import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { WeightLog } from '@meal-planning/shared-types';
import { ApiError, logsApi } from '../api/client';

export function WeightLogForm({ onLogged }: { onLogged: (log: WeightLog) => void }) {
  const [weightKg, setWeightKg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const log = await logsApi.weight.create({ weightKg: Number(weightKg) });
      setWeightKg('');
      onLogged(log);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Log weight (kg)</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={weightKg}
          onChangeText={setWeightKg}
        />
        <Pressable style={styles.button} disabled={isSubmitting} onPress={() => void handleSubmit()}>
          <Text style={styles.buttonText}>{isSubmitting ? 'Logging…' : 'Log'}</Text>
        </Pressable>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  label: { fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8, marginTop: 4 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 4, padding: 10, fontSize: 16 },
  button: { backgroundColor: '#1a7f37', borderRadius: 4, paddingHorizontal: 16, justifyContent: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  error: { color: '#cf222e', marginTop: 4 },
});
