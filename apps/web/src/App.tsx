import { useState } from 'react';
import './App.css';
import { AuthProvider } from './auth/AuthProvider';
import { useAuth } from './auth/useAuth';
import { LoginForm } from './auth/LoginForm';
import { RegisterForm } from './auth/RegisterForm';
import { Dashboard } from './components/Dashboard';

type AuthView = 'login' | 'register';

function UnauthenticatedApp() {
  const [view, setView] = useState<AuthView>('login');

  return (
    <div className="dashboard-shell">
      {view === 'login' ? (
        <LoginForm onSwitchToRegister={() => setView('register')} />
      ) : (
        <RegisterForm onSwitchToLogin={() => setView('login')} />
      )}
    </div>
  );
}

function AppShell() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="dashboard-shell">Loading…</div>;
  }

  return user ? <Dashboard /> : <UnauthenticatedApp />;
}

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

export default App;
