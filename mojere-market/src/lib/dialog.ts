import { Alert, Platform, type AlertButton } from 'react-native';

/**
 * Same as React Native's Alert.alert, but also works in a web browser
 * (where Alert.alert does nothing). On the web:
 * - one button (or none) → a simple message box;
 * - a "cancel" button plus one action → an OK/Cancel box that runs the action on OK.
 */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }
  const text = message ? `${title}\n\n${message}` : title;
  const actions = (buttons ?? []).filter((b) => b.style !== 'cancel');
  const hasCancel = (buttons ?? []).some((b) => b.style === 'cancel');
  if (typeof window === 'undefined') return;
  if (hasCancel && actions.length > 0) {
    if (window.confirm(text)) actions[0]?.onPress?.();
    else (buttons ?? []).find((b) => b.style === 'cancel')?.onPress?.();
    return;
  }
  window.alert(text);
  actions[0]?.onPress?.();
}
