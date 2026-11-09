import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useAuth } from './auth';
import { supabase } from './supabase';

/**
 * Push notifications (alerts on the lock screen) only work in a real
 * installed build of Mojere Market that has an Expo project id — not in
 * Expo Go and not on simulators. Everywhere else this quietly does nothing,
 * and in-app notifications keep working as before.
 */
export function pushProjectId(): string | null {
  const fromExtra = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  return fromExtra ?? Constants.easConfig?.projectId ?? null;
}

export function canUsePush(): boolean {
  return (
    !!supabase &&
    Platform.OS !== 'web' &&
    Device.isDevice &&
    Constants.executionEnvironment !== ExecutionEnvironment.StoreClient && // not Expo Go
    !!pushProjectId()
  );
}

export type PushRegistration = { status: 'registered' | 'denied' | 'unavailable' | 'error'; message?: string };

export async function registerForPush(userId: string): Promise<PushRegistration> {
  if (!canUsePush()) return { status: 'unavailable' };
  try {
    const Notifications = await import('expo-notifications');
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Mojere Market',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const current = await Notifications.getPermissionsAsync();
    const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
    if (!permission.granted) return { status: 'denied' };

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: pushProjectId()! });
    const { error } = await supabase!
      .from('push_tokens')
      .upsert({ token, user_id: userId, platform: Platform.OS === 'ios' ? 'ios' : 'android' }, { onConflict: 'token' });
    if (error) return { status: 'error', message: error.message };
    return { status: 'registered' };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

/** Where tapping a notification should take the user. */
export function routeForNotificationData(data: Record<string, unknown> | undefined) {
  if (data && typeof data.conversation_id === 'string') {
    return { pathname: '/chat/[id]' as const, params: { id: data.conversation_id } };
  }
  if (data && typeof data.listing_id === 'string') {
    return { pathname: '/listing/[id]' as const, params: { id: data.listing_id } };
  }
  return null;
}

/** Register the device after login, and open the right screen when an alert is tapped. */
export function usePushNotifications() {
  const { session } = useAuth();
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId || !canUsePush()) return;
    let cleanup: (() => void) | undefined;
    void (async () => {
      const Notifications = await import('expo-notifications');
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
      await registerForPush(userId);
      const sub = Notifications.addNotificationResponseReceivedListener((response) => {
        const target = routeForNotificationData(response.notification.request.content.data as Record<string, unknown>);
        if (target) router.push(target);
      });
      cleanup = () => sub.remove();
    })();
    return () => cleanup?.();
  }, [userId]);
}
