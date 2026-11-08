import { router, type Href } from 'expo-router';

/** Close any sign-in/sign-up screens, then go to `to`. */
export function leaveAuthFlow(to: Href) {
  if (router.canDismiss()) router.dismissAll();
  router.navigate(to);
}
