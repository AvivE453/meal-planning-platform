import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ActivityLevel, Goal, Sex, UserProfile } from '@meal-planning/shared-types';
import { ApiError, profileApi } from '../api/client';

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light', label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'active', label: 'Active' },
  { value: 'very_active', label: 'Very active' },
];

const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: 'weight_loss', label: 'Weight loss' },
  { value: 'weight_gain', label: 'Weight gain' },
  { value: 'maintenance', label: 'Maintenance' },
];

function OptionGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.optionGroup}>
      {options.map((opt) => (
        <Pressable
          key={opt.value}
          style={[styles.option, value === opt.value && styles.optionSelected]}
          onPress={() => onChange(opt.value)}
        >
          <Text style={value === opt.value ? styles.optionTextSelected : styles.optionText}>{opt.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function OnboardingScreen({ onComplete }: { onComplete: (profile: UserProfile) => void }) {
  const [sex, setSex] = useState<Sex>('male');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');
  const [goal, setGoal] = useState<Goal>('maintenance');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const profile = await profileApi.upsert({ sex, dateOfBirth, heightCm: Number(heightCm), activityLevel, goal });
      onComplete(profile);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.form}>
      <Text style={styles.title}>Set up your profile</Text>
      <Text style={styles.hint}>Used to calculate your calorie and macro targets.</Text>

      <Text style={styles.label}>Sex</Text>
      <OptionGroup options={SEX_OPTIONS} value={sex} onChange={setSex} />

      <Text style={styles.label}>Date of birth (YYYY-MM-DD)</Text>
      <TextInput style={styles.input} placeholder="1995-06-15" value={dateOfBirth} onChangeText={setDateOfBirth} />

      <Text style={styles.label}>Height (cm)</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={heightCm} onChangeText={setHeightCm} />

      <Text style={styles.label}>Activity level</Text>
      <OptionGroup options={ACTIVITY_OPTIONS} value={activityLevel} onChange={setActivityLevel} />

      <Text style={styles.label}>Goal</Text>
      <OptionGroup options={GOAL_OPTIONS} value={goal} onChange={setGoal} />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.submitButton} disabled={isSubmitting} onPress={() => void handleSubmit()}>
        <Text style={styles.submitButtonText}>{isSubmitting ? 'Saving…' : 'Save profile'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { width: '100%', maxWidth: 360, gap: 4 },
  title: { fontSize: 20, fontWeight: '600', textAlign: 'center' },
  hint: { fontSize: 12, color: '#666', textAlign: 'center', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 4, padding: 10, fontSize: 16 },
  optionGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  option: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, borderWidth: 1, borderColor: '#ccc' },
  optionSelected: { backgroundColor: '#1a7f37', borderColor: '#1a7f37' },
  optionText: { fontSize: 13, color: '#333' },
  optionTextSelected: { fontSize: 13, color: '#fff', fontWeight: '600' },
  error: { color: '#cf222e', marginTop: 8 },
  submitButton: { backgroundColor: '#1a7f37', borderRadius: 4, padding: 12, marginTop: 16, alignItems: 'center' },
  submitButtonText: { color: '#fff', fontWeight: '600' },
});
