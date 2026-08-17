import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { AuthProvider } from './src/auth/AuthProvider';
import { useAuth } from './src/auth/useAuth';
import { LoginScreen } from './src/auth/LoginScreen';
import { RegisterScreen } from './src/auth/RegisterScreen';
import { Dashboard } from './src/components/Dashboard';

type AuthView = 'login' | 'register';

function UnauthenticatedApp() {
  const [view, setView] = useState<AuthView>('login');

  return (
    <View style={styles.centered}>
      {view === 'login' ? (
        <LoginScreen onSwitchToRegister={() => setView('register')} />
      ) : (
        <RegisterScreen onSwitchToLogin={() => setView('login')} />
      )}
    </View>
  );
}

function AppShell() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <Text>Loading…</Text>
      </View>
    );
  }

  return user ? <Dashboard /> : <UnauthenticatedApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <SafeAreaView style={styles.container}>
        <AppShell />
        <StatusBar style="auto" />
      </SafeAreaView>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
});
