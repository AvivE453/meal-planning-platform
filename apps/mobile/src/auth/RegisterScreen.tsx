import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from './useAuth';

const MIN_PASSWORD_LENGTH = 8;

export function RegisterScreen({ onSwitchToLogin }: { onSwitchToLogin: () => void }) {
  const { register, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
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
    <View style={styles.form}>
      <Text style={styles.title}>Create an account</Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        secureTextEntry
        autoComplete="new-password"
        value={password}
        onChangeText={setPassword}
      />
      <Text style={styles.hint}>At least {MIN_PASSWORD_LENGTH} characters.</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} disabled={isSubmitting} onPress={() => void handleSubmit()}>
        <Text style={styles.buttonText}>{isSubmitting ? 'Creating account…' : 'Create account'}</Text>
      </Pressable>

      <Pressable onPress={onSwitchToLogin}>
        <Text style={styles.link}>Already have an account? Log in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { width: '100%', maxWidth: 320, gap: 4 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  label: { fontSize: 13, fontWeight: '600', marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 4, padding: 10, fontSize: 16 },
  hint: { fontSize: 12, color: '#666' },
  error: { color: '#cf222e', marginTop: 8 },
  button: { backgroundColor: '#1a7f37', borderRadius: 4, padding: 12, marginTop: 16, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  link: { color: '#0969da', textAlign: 'center', marginTop: 16 },
});
