import Ionicons from '@expo/vector-icons/Ionicons';

import { SetupNotice } from '@/components/setup-notice';
import { AppText, Card, Screen } from '@/components/ui';
import { colors } from '@/theme';

export default function MessagesScreen() {
  return (
    <Screen>
      <AppText variant="heading">Messages</AppText>
      <SetupNotice />
      <Card style={{ alignItems: 'center', paddingVertical: 40 }}>
        <Ionicons name="chatbubbles-outline" size={40} color={colors.textMuted} />
        <AppText variant="title">No conversations yet</AppText>
        <AppText muted style={{ textAlign: 'center' }}>
          Private chats between buyers and sellers will appear here. Only the two people in a
          conversation will be able to read it.
        </AppText>
      </Card>
    </Screen>
  );
}
