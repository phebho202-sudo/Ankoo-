import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { OfflineBanner } from "@/components/offline-banner";
import { AuthProvider } from "@/lib/auth";
import { usePushNotifications } from "@/lib/push";
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
          <PushSetup />
          <OfflineBanner />
          <Stack
            screenOptions={{
              headerTintColor: colors.primary,
              // Show only the back arrow, never internal route names like "(tabs)".
              headerBackButtonDisplayMode: "minimal",
              // Solid header so screen content never slides underneath it.
              headerTransparent: false,
              headerStyle: { backgroundColor: colors.background },
              headerShadowVisible: false,
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
            <Stack.Screen name="listing/[id]" options={{ title: "Item" }} />
            <Stack.Screen
              name="listing-editor"
              options={{ title: "Sell an item" }}
            />
            <Stack.Screen
              name="my-listings"
              options={{ title: "My listings" }}
            />
            <Stack.Screen name="chat/[id]" options={{ title: "Chat" }} />
            <Stack.Screen
              name="admin/index"
              options={{ title: "Admin dashboard" }}
            />
            <Stack.Screen
              name="admin/listings"
              options={{ title: "Moderate listings" }}
            />
            <Stack.Screen name="admin/reports" options={{ title: "Reports" }} />
            <Stack.Screen name="admin/users" options={{ title: "Users" }} />
            <Stack.Screen
              name="admin/money"
              options={{ title: "Promotions and payments" }}
            />
            <Stack.Screen
              name="admin/catalog"
              options={{ title: "Categories and settings" }}
            />
            <Stack.Screen name="admin/audit" options={{ title: "Audit log" }} />
            <Stack.Screen
              name="guidelines"
              options={{ title: "Community guidelines" }}
            />
            <Stack.Screen
              name="business/index"
              options={{ title: "Mojere Market Business" }}
            />
            <Stack.Screen
              name="business/[slug]"
              options={{ title: "Business" }}
            />
            <Stack.Screen name="promote/[id]" options={{ title: "Promote" }} />
            <Stack.Screen
              name="notifications"
              options={{ title: "Notifications" }}
            />
            <Stack.Screen
              name="notification-settings"
              options={{ title: "Notification settings" }}
            />
            <Stack.Screen
              name="favourites"
              options={{ title: "Saved items" }}
            />
            <Stack.Screen
              name="declutter/index"
              options={{ title: "Declutter My Home" }}
            />
            <Stack.Screen
              name="declutter/[id]"
              options={{ title: "Declutter session" }}
            />
            <Stack.Screen name="seller/[id]" options={{ title: "Seller" }} />
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

/** Registers for phone alerts in installed builds (does nothing in Expo Go). */
function PushSetup() {
  usePushNotifications();
  return null;
}
