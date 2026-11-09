import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

import { AppText } from './ui';

/**
 * Tells TanStack Query when the phone goes offline (it pauses loading and
 * retries automatically when the connection returns) and shows a banner.
 */
export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    onlineManager.setEventListener((setOnline) =>
      NetInfo.addEventListener((state) => {
        const online = state.isConnected !== false && state.isInternetReachable !== false;
        setOnline(online);
        setOffline(!online);
      }),
    );
  }, []);

  if (!offline) return null;
  return (
    <View
      accessibilityRole="alert"
      style={{
        position: 'absolute',
        top: insets.top,
        left: spacing.md,
        right: spacing.md,
        zIndex: 100,
        backgroundColor: colors.text,
        borderRadius: 10,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
      }}>
      <AppText variant="small" style={{ color: colors.textOnPrimary, textAlign: 'center' }}>
        You are offline. Things will update when your connection returns.
      </AppText>
    </View>
  );
}
