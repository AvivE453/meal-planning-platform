import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import type { UserProfile } from '@meal-planning/shared-types';
import { ApiError, profileApi } from '../api/client';
import { useAuth } from '../auth/useAuth';
import { Onboarding } from '../profile/Onboarding';

export interface DashboardContext {
  profile: UserProfile;
  onProfileUpdated: (profile: UserProfile) => void;
}

const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/plan', label: 'Meal Plan' },
  { to: '/weight', label: 'Tracking' },
  { to: '/nutrition', label: 'Nutrition' },
];

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    try {
      setProfile(await profileApi.get());
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setProfile(null);
      } else {
        throw err;
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  if (isLoading) {
    return <div className="dashboard-shell">Loading…</div>;
  }

  if (!profile) {
    return (
      <div className="dashboard-shell">
        <Onboarding onComplete={setProfile} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="app-toolbar-right">
        <span className="app-user">{user?.email}</span>
        <button type="button" className="logout-button" onClick={() => void logout()}>
          Log out
        </button>
      </div>
      <nav className="app-nav">
        {NAV_LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => (isActive ? 'app-nav-link active' : 'app-nav-link')}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
      <main className="app-content">
        <Outlet context={{ profile, onProfileUpdated: setProfile } satisfies DashboardContext} />
      </main>
    </div>
  );
}
