import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { DailyNutritionLog } from '@meal-planning/shared-types';
import { ApiError, logsApi } from '../api/client';

export function NutritionLogForm({ onLogged }: { onLogged: (log: DailyNutritionLog) => void }) {
  const [calories, setCalories] = useState('');
  const [proteinG, setProteinG] = useState('');
  const [carbsG, setCarbsG] = useState('');
  const [fatG, setFatG] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const log = await logsApi.nutrition.create({
        source: 'manual',
        calories: Number(calories),
        proteinG: Number(proteinG || 0),
        carbsG: Number(carbsG || 0),
        fatG: Number(fatG || 0),
      });
      setCalories('');
      setProteinG('');
      setCarbsG('');
      setFatG('');
      onLogged(log);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Log food eaten (manual)</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder="kcal"
          value={calories}
          onChangeText={setCalories}
        />
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder="protein g"
          value={proteinG}
          onChangeText={setProteinG}
        />
      </View>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder="carbs g"
          value={carbsG}
          onChangeText={setCarbsG}
        />
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder="fat g"
          value={fatG}
          onChangeText={setFatG}
        />
      </View>
      <Pressable style={styles.button} disabled={isSubmitting} onPress={() => void handleSubmit()}>
        <Text style={styles.buttonText}>{isSubmitting ? 'Logging…' : 'Log'}</Text>
      </Pressable>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  label: { fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8, marginTop: 4 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 4, padding: 10, fontSize: 16 },
  button: {
    backgroundColor: '#1a7f37',
    borderRadius: 4,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  error: { color: '#cf222e', marginTop: 4 },
});
