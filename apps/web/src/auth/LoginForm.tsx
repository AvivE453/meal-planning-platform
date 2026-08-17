import { useState, type FormEvent } from 'react';
import { useAuth } from './useAuth';

export function LoginForm({ onSwitchToRegister }: { onSwitchToRegister: () => void }) {
  const { login, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch {
      // error is already surfaced via context state
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={(e) => void handleSubmit(e)}>
      <h2>Log in</h2>

      <label htmlFor="login-email">Email</label>
      <input
        id="login-email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <label htmlFor="login-password">Password</label>
      <input
        id="login-password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Logging in…' : 'Log in'}
      </button>

      <p>
        No account?{' '}
        <button type="button" className="link-button" onClick={onSwitchToRegister}>
          Register
        </button>
      </p>
    </form>
  );
}
