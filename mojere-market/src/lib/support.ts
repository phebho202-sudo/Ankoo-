import { Alert, Linking } from 'react-native';

import { BRAND } from '@/constants/brand';

/** Opens the phone's email app addressed to support, or shows the address if that fails. */
export async function contactSupport(subject = `${BRAND.name} help`): Promise<void> {
  const url = `mailto:${BRAND.supportEmail}?subject=${encodeURIComponent(subject)}`;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Contact support', `Email us at ${BRAND.supportEmail}`);
  }
}
