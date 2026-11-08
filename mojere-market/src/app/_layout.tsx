import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "@/lib/auth";
import { colors } from "@/theme";

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
        <AuthProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerTintColor: colors.primary,
              // Show only the back arrow, never internal route names like "(tabs)".
              headerBackButtonDisplayMode: "minimal",
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen
              name="(tabs)"
              options={{ headerShown: false, title: "Back" }}
            />
            <Stack.Screen name="auth/welcome" options={{ title: "" }} />
            <Stack.Screen
              name="auth/sign-up"
              options={{ title: "Create account" }}
            />
            <Stack.Screen name="auth/sign-in" options={{ title: "Log in" }} />
            <Stack.Screen
              name="auth/verify-email"
              options={{ title: "Confirm email" }}
            />
            <Stack.Screen
              name="auth/forgot-password"
              options={{ title: "Reset password" }}
            />
            <Stack.Screen
              name="edit-profile"
              options={{ title: "Edit profile" }}
            />
            <Stack.Screen
              name="terms"
              options={{ title: "Terms and Privacy" }}
            />
          </Stack>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
