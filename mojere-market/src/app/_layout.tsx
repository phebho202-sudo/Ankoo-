import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/theme';

export default function RootLayout() {
  // One cache for all server data. Conservative retries suit slower mobile networks.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 2, staleTime: 60_000, refetchOnWindowFocus: false },
          mutations: { retry: 0 }, // never silently repeat a submission
        },
      }),
  );

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerTintColor: colors.primary,
            contentStyle: { backgroundColor: colors.background },
          }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
