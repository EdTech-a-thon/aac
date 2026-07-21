import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  Button,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const apiUrl = process.env.EXPO_PUBLIC_API_URL;

export default function App() {
  const [number, setNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchNumber() {
    if (!apiUrl) {
      setError('EXPO_PUBLIC_API_URL is not set');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      setNumber(await response.text());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Button
        title={loading ? 'Loading…' : 'Get random number'}
        onPress={fetchNumber}
        disabled={loading}
      />
      {loading ? <ActivityIndicator style={styles.result} /> : null}
      {number !== null ? <Text style={styles.result}>{number}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  result: {
    marginTop: 8,
    fontSize: 24,
  },
  error: {
    marginTop: 8,
    color: '#b00020',
  },
});
