import { useState, type FormEvent } from 'react';
import { useAuth } from './useAuth';

const MIN_PASSWORD_LENGTH = 8;

export function RegisterForm({ onSwitchToLogin }: { onSwitchToLogin: () => void }) {
  const { register, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await register(email, password);
    } catch {
      // error is already surfaced via context state
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={(e) => void handleSubmit(e)}>
      <h2>Create an account</h2>

      <label htmlFor="register-email">Email</label>
      <input
        id="register-email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <label htmlFor="register-password">Password</label>
      <input
        id="register-password"
        type="password"
        autoComplete="new-password"
        required
        minLength={MIN_PASSWORD_LENGTH}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <p className="field-hint">At least {MIN_PASSWORD_LENGTH} characters.</p>

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating account…' : 'Create account'}
      </button>

      <p>
        Already have an account?{' '}
        <button type="button" className="link-button" onClick={onSwitchToLogin}>
          Log in
        </button>
      </p>
    </form>
  );
}
