import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type {
  DailyNutritionLog,
  MealPlan,
  NutritionTargets,
  UserProfile,
  WeightLog,
} from '@meal-planning/shared-types';
import { ApiError, logsApi, mealPlansApi, profileApi } from '../api/client';
import { useAuth } from '../auth/useAuth';
import { OnboardingScreen } from '../profile/OnboardingScreen';
import { MealPlanCard } from './MealPlanCard';
import { NutritionLogForm } from './NutritionLogForm';
import { NutritionLogList } from './NutritionLogList';
import { TargetsCard } from './TargetsCard';
import { WeightLogForm } from './WeightLogForm';
import { WeightLogList } from './WeightLogList';

export function Dashboard() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [targets, setTargets] = useState<NutritionTargets | null>(null);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [latestPlan, setLatestPlan] = useState<MealPlan | null>(null);
  const [nutritionLogs, setNutritionLogs] = useState<DailyNutritionLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshTargetsAndLogs = useCallback(async () => {
    setWeightLogs(await logsApi.weight.list());
    try {
      setTargets(await profileApi.targets());
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setTargets(null);
      } else {
        throw err;
      }
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const loadedProfile = await profileApi.get();
        setProfile(loadedProfile);
        await refreshTargetsAndLogs();
        const plans = await mealPlansApi.list();
        setLatestPlan(plans[0] ?? null);
        setNutritionLogs(await logsApi.nutrition.list());
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setProfile(null);
        } else {
          throw err;
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, [refreshTargetsAndLogs]);

  if (isLoading) {
    return <Text>Loading…</Text>;
  }

  if (!profile) {
    return (
      <OnboardingScreen
        onComplete={(newProfile) => {
          setProfile(newProfile);
          void refreshTargetsAndLogs();
        }}
      />
    );
  }

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Meal Planning & Tracking Platform</Text>
      <Text>Signed in as {user?.email}</Text>

      <TargetsCard targets={targets} />

      <MealPlanCard
        plan={latestPlan}
        onGenerated={setLatestPlan}
        onLogged={(log) => setNutritionLogs((prev) => [log, ...prev])}
      />

      <WeightLogForm
        onLogged={(log) => {
          setWeightLogs((prev) => [log, ...prev]);
          void refreshTargetsAndLogs();
        }}
      />
      <WeightLogList logs={weightLogs} />

      <NutritionLogForm onLogged={(log) => setNutritionLogs((prev) => [log, ...prev])} />
      <NutritionLogList logs={nutritionLogs} />

      <Pressable style={styles.logoutButton} onPress={() => void logout()}>
        <Text style={styles.logoutButtonText}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1, width: '100%' },
  container: { alignItems: 'center', gap: 16, padding: 24, width: '100%' },
  title: { fontSize: 20, fontWeight: '600', textAlign: 'center' },
  logoutButton: { backgroundColor: '#cf222e', borderRadius: 4, padding: 12, marginTop: 8 },
  logoutButtonText: { color: '#fff', fontWeight: '600' },
});
