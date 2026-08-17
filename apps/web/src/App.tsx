import { useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './App.css';
import { AuthProvider } from './auth/AuthProvider';
import { useAuth } from './auth/useAuth';
import { LoginForm } from './auth/LoginForm';
import { RegisterForm } from './auth/RegisterForm';
import { DashboardLayout } from './layout/DashboardLayout';
import { HomePage } from './pages/HomePage';
import { MealPlanPage } from './pages/MealPlanPage';
import { WeightPage } from './pages/WeightPage';
import { NutritionPage } from './pages/NutritionPage';

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

  if (!user) {
    return <UnauthenticatedApp />;
  }

  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route index element={<HomePage />} />
        <Route path="plan" element={<MealPlanPage />} />
        <Route path="weight" element={<WeightPage />} />
        <Route path="nutrition" element={<NutritionPage />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
