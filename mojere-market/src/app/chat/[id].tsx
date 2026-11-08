import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TextField } from '@/components/form';
import { ListingPhoto } from '@/components/listing-card';
import { OfferSheet } from '@/components/offer-sheet';
import { AppText, Button, Notice } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { formatNaira } from '@/lib/format';
import {
  markConversationRead,
  reportUser,
  useBlockUser,
  useConversation,
  useConversations,
  useLiveMessages,
  useMessages,
  useSendMessage,
  type Message,
} from '@/lib/messaging';
import {
  friendlyOfferError,
  OFFER_STATUS_LABELS,
  useConfirmHandover,
  useMakeOffer,
  useMyReview,
  useOffers,
  useRespondToOffer,
  useSubmitReview,
  type Offer,
} from '@/lib/offers';
import { timeAgo } from '@/lib/time';
import { colors, fontSize, MIN_TOUCH, radius, spacing } from '@/theme';

/* ---------------- Offers panel ---------------- */

function OfferCard({ offer, me, onCounter }: { offer: Offer; me: string; onCounter: (o: Offer) => void }) {
  const respond = useRespondToOffer();
  const confirm = useConfirmHandover();
  const myReview = useMyReview(offer.status === 'accepted' ? offer.id : undefined);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const iAmBuyer = offer.buyer_id === me;
  const creator = offer.made_by === 'buyer' ? offer.buyer_id : offer.seller_id;
  const iMadeIt = creator === me;
  const pending = offer.status === 'pending' && new Date(offer.expires_at) > new Date();
  const myConfirmed = iAmBuyer ? !!offer.buyer_confirmed_at : !!offer.seller_confirmed_at;
  const theirConfirmed = iAmBuyer ? !!offer.seller_confirmed_at : !!offer.buyer_confirmed_at;
  const complete = offer.status === 'accepted' && myConfirmed && theirConfirmed;

  async function run(action: 'accept' | 'reject' | 'withdraw') {
    setError(null);
    try {
      await respond.mutateAsync({ offerId: offer.id, action });
    } catch (e) {
      setError(friendlyOfferError(e));
    }
  }

  function askAccept() {
    Alert.alert(
      'Accept this offer?',
      `You agree to sell for ${formatNaira(offer.amount_kobo)}. The item will show as reserved. No money is taken by Mojere Market.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Accept', onPress: () => void run('accept') },
      ],
    );
  }

  async function confirmHandover() {
    setError(null);
    try {
      await confirm.mutateAsync(offer.id);
    } catch (e) {
      setError(friendlyOfferError(e));
    }
  }

  return (
    <View style={styles.offer}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <AppText style={{ fontWeight: '700' }}>
          {iMadeIt ? 'Your offer' : offer.made_by === 'seller' ? 'Seller’s counteroffer' : 'Buyer’s offer'}:{' '}
          {formatNaira(offer.amount_kobo)}
        </AppText>
        <AppText variant="caption">{pending ? OFFER_STATUS_LABELS.pending : OFFER_STATUS_LABELS[offer.status === 'pending' ? 'expired' : offer.status]}</AppText>
      </View>
      {offer.message ? <AppText variant="small">“{offer.message}”</AppText> : null}

      {pending && !iMadeIt ? (
        <View style={styles.row}>
          <Button label="Accept" onPress={askAccept} style={styles.flex} disabled={respond.isPending} />
          <Button label="Counter" kind="outline" onPress={() => onCounter(offer)} style={styles.flex} disabled={respond.isPending} />
          <Button label="Decline" kind="outline" onPress={() => void run('reject')} style={styles.flex} disabled={respond.isPending} />
        </View>
      ) : null}
      {pending && iMadeIt ? (
        <Button label="Withdraw offer" kind="outline" onPress={() => void run('withdraw')} loading={respond.isPending} />
      ) : null}

      {offer.status === 'accepted' && !complete ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="small">
            Agreed at {formatNaira(offer.amount_kobo)}. Meet in a safe public place. After the handover, both of you confirm
            here.
          </AppText>
          {myConfirmed ? (
            <AppText variant="small" style={{ color: colors.success, fontWeight: '700' }}>
              You confirmed the handover. Waiting for the {iAmBuyer ? 'seller' : 'buyer'} to confirm.
            </AppText>
          ) : (
            <Button
              label={iAmBuyer ? 'I received the item' : 'I handed over the item and was paid'}
              onPress={() =>
                Alert.alert('Confirm the handover?', 'Only confirm once the item and the money have really changed hands.', [
                  { text: 'Not yet', style: 'cancel' },
                  { text: 'Confirm', onPress: () => void confirmHandover() },
                ])
              }
              loading={confirm.isPending}
            />
          )}
          {theirConfirmed && !myConfirmed ? (
            <AppText variant="caption">The {iAmBuyer ? 'seller' : 'buyer'} has already confirmed.</AppText>
          ) : null}
        </View>
      ) : null}

      {complete ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="small" style={{ color: colors.success, fontWeight: '700' }}>
            Sale confirmed by both of you. 🎉
          </AppText>
          {myReview.data ? (
            <AppText variant="caption">You left a {myReview.data.rating}-star review. Thank you!</AppText>
          ) : myReview.isSuccess ? (
            <Button label={`Review the ${iAmBuyer ? 'seller' : 'buyer'}`} kind="outline" onPress={() => setReviewOpen(true)} />
          ) : null}
        </View>
      ) : null}

      {error ? <Notice tone="danger" title={error} /> : null}
      {reviewOpen ? <ReviewSheet offerId={offer.id} onClose={() => setReviewOpen(false)} /> : null}
    </View>
  );
}

function ReviewSheet({ offerId, onClose }: { offerId: string; onClose: () => void }) {
  const submit = useSubmitReview();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (rating < 1) {
      setError('Choose 1 to 5 stars.');
      return;
    }
    try {
      await submit.mutateAsync({ offerId, rating, comment });
      onClose();
    } catch (e) {
      setError(friendlyOfferError(e));
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <AppText variant="title" style={{ flex: 1 }}>
            Leave a review
          </AppText>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} onPress={onClose}>
            <Ionicons name="close" size={28} color={colors.text} />
          </Pressable>
        </View>
        <AppText muted>Reviews are public and help others trade safely. Be honest and polite.</AppText>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} accessibilityRole="button" accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`} onPress={() => setRating(n)} hitSlop={6}>
              <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={36} color={colors.accent} />
            </Pressable>
          ))}
        </View>
        <TextField label="Comment (optional)" multiline maxLength={500} value={comment} onChangeText={setComment} />
        {error ? <Notice tone="danger" title={error} /> : null}
        <Button label="Submit review" onPress={() => void send()} loading={submit.isPending} />
      </SafeAreaView>
    </Modal>
  );
}

/* ---------------- Chat screen ---------------- */

export default function ChatScreen() {
  const { id, offer: openOffer } = useLocalSearchParams<{ id: string; offer?: string }>();
  const { session } = useAuth();
  const me = session?.user.id ?? '';
  const conv = useConversation(id);
  const inbox = useConversations();
  const summary = inbox.data?.find((c) => c.id === id);
  const messages = useMessages(id);
  const offers = useOffers(conv.data?.listing_id, conv.data?.buyer_id);
  const send = useSendMessage(id ?? '');
  const block = useBlockUser();
  const makeOffer = useMakeOffer();
  const respond = useRespondToOffer();
  useLiveMessages(id);

  const [text, setText] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [offerSheet, setOfferSheet] = useState<'new' | Offer | null>(openOffer === '1' ? 'new' : null);
  const [reporting, setReporting] = useState<{ messageId?: string } | null>(null);

  const newestId = messages.data?.pages?.[0]?.[0]?.id;
  useEffect(() => {
    if (id) void markConversationRead(id);
  }, [id, newestId]);

  const items = useMemo(() => messages.data?.pages.flat() ?? [], [messages.data]);
  const iAmBuyer = conv.data?.buyer_id === me;
  const otherId = iAmBuyer ? conv.data?.seller_id : conv.data?.buyer_id;
  const blocked = !!summary?.blocked_by_me;
  const visibleOffers = (offers.data ?? []).filter((o) => !['withdrawn', 'rejected', 'countered'].includes(o.status)).slice(0, 2);
  const hasOpenOffer = (offers.data ?? []).some(
    (o) => (o.status === 'pending' && new Date(o.expires_at) > new Date()) || o.status === 'accepted',
  );
  const canOffer = iAmBuyer && summary?.listing_status === 'active' && !hasOpenOffer && !blocked;

  async function sendMessage() {
    setSendError(null);
    try {
      await send.mutateAsync(text);
      setText('');
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Message not sent. Check your connection.');
    }
  }

  if (conv.isLoading) {
    return <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: spacing.xxl }} />;
  }
  if (!conv.data) {
    return (
      <View style={{ padding: spacing.lg }}>
        <Notice tone="danger" title="This conversation could not be found." />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <Stack.Screen
        options={{
          title: summary?.other_name ?? 'Chat',
          headerRight: () => (
            <Pressable accessibilityRole="button" accessibilityLabel="Chat options" hitSlop={12} onPress={() => setMenuOpen(true)}>
              <Ionicons name="ellipsis-vertical" size={22} color={colors.primary} />
            </Pressable>
          ),
        }}
      />

      {/* Item this chat is about */}
      {conv.data.listing_id ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View item ${summary?.listing_title ?? ''}`}
          onPress={() => router.push({ pathname: '/listing/[id]', params: { id: conv.data!.listing_id! } })}
          style={styles.itemBar}>
          <ListingPhoto path={summary?.listing_cover_path} style={styles.itemThumb} />
          <View style={{ flex: 1 }}>
            <AppText style={{ fontWeight: '700' }} numberOfLines={1}>
              {summary?.listing_title ?? 'Item no longer available'}
            </AppText>
            {summary?.listing_price_kobo != null ? (
              <AppText variant="small">
                {formatNaira(summary.listing_price_kobo)}
                {summary.listing_status && summary.listing_status !== 'active' ? ` · ${summary.listing_status}` : ''}
              </AppText>
            ) : null}
          </View>
          {canOffer ? <Button label="Make offer" kind="accent" onPress={() => setOfferSheet('new')} style={{ minHeight: 40 }} /> : null}
        </Pressable>
      ) : null}

      {visibleOffers.length ? (
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.sm }}>
          {visibleOffers.map((o) => (
            <OfferCard key={o.id} offer={o} me={me} onCounter={(x) => setOfferSheet(x)} />
          ))}
        </View>
      ) : null}

      <FlatList
        data={items}
        inverted
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        onEndReached={() => {
          if (messages.hasNextPage && !messages.isFetchingNextPage) void messages.fetchNextPage();
        }}
        onEndReachedThreshold={0.3}
        renderItem={({ item }) => (
          <Bubble message={item} mine={item.sender_id === me} onReport={() => setReporting({ messageId: item.id })} />
        )}
        ListFooterComponent={
          <Notice tone="warning" title="Stay safe">
            <AppText variant="small">
              Never share OTPs or PINs. Don’t pay “delivery” or “verification” fees. Confirm money is in your account before
              handing over items.
            </AppText>
          </Notice>
        }
        ListEmptyComponent={
          messages.isLoading ? <ActivityIndicator color={colors.primary} /> : (
            <AppText muted style={{ textAlign: 'center', transform: [{ scaleY: -1 }] }}>
              Say hello and ask about the item.
            </AppText>
          )
        }
      />

      {blocked ? (
        <View style={styles.composer}>
          <AppText variant="small" muted style={{ flex: 1 }}>
            You blocked this person. Unblock them from the ⋮ menu to message again.
          </AppText>
        </View>
      ) : (
        <View>
          {sendError ? (
            <AppText variant="caption" style={{ color: colors.danger, paddingHorizontal: spacing.md }}>
              {sendError}
            </AppText>
          ) : null}
          <View style={styles.composer}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Write a message…"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={2000}
              accessibilityLabel="Message"
              maxFontSizeMultiplier={1.6}
              style={styles.input}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              accessibilityState={{ disabled: !text.trim() || send.isPending }}
              disabled={!text.trim() || send.isPending}
              onPress={() => void sendMessage()}
              style={[styles.send, (!text.trim() || send.isPending) && { opacity: 0.4 }]}>
              {send.isPending ? <ActivityIndicator color={colors.textOnPrimary} /> : <Ionicons name="send" size={20} color={colors.textOnPrimary} />}
            </Pressable>
          </View>
        </View>
      )}

      {/* Options menu */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)} accessibilityLabel="Close menu">
          <View style={styles.menu}>
            <Button
              label={blocked ? 'Unblock this person' : 'Block this person'}
              kind="outline"
              onPress={() => {
                setMenuOpen(false);
                if (!otherId) return;
                if (blocked) block.mutate({ userId: otherId, block: false });
                else
                  Alert.alert('Block this person?', 'They will not be able to message you or make offers on your items.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Block', style: 'destructive', onPress: () => block.mutate({ userId: otherId, block: true }) },
                  ]);
              }}
            />
            <Button
              label="Report this person"
              kind="outline"
              onPress={() => {
                setMenuOpen(false);
                setReporting({});
              }}
            />
            <Button label="Cancel" kind="outline" onPress={() => setMenuOpen(false)} />
          </View>
        </Pressable>
      </Modal>

      {offerSheet ? (
        <OfferSheet
          title={offerSheet === 'new' ? 'Make an offer' : 'Counteroffer'}
          askingKobo={offerSheet === 'new' ? summary?.listing_price_kobo : offerSheet.amount_kobo}
          withMessage={offerSheet === 'new'}
          submitLabel={offerSheet === 'new' ? 'Send offer' : 'Send counteroffer'}
          onClose={() => setOfferSheet(null)}
          onSubmit={async (amountKobo, message) => {
            try {
              if (offerSheet === 'new') {
                await makeOffer.mutateAsync({ listingId: conv.data!.listing_id!, amountKobo, message });
              } else {
                await respond.mutateAsync({ offerId: offerSheet.id, action: 'counter', counterKobo: amountKobo });
              }
              setOfferSheet(null);
            } catch (e) {
              throw new Error(friendlyOfferError(e));
            }
          }}
        />
      ) : null}

      {reporting && otherId ? (
        <ReportUserSheet userId={otherId} messageId={reporting.messageId} onClose={() => setReporting(null)} />
      ) : null}
    </KeyboardAvoidingView>
  );
}

function Bubble({ message, mine, onReport }: { message: Message; mine: boolean; onReport: () => void }) {
  return (
    <Pressable
      onLongPress={mine ? undefined : onReport}
      accessibilityHint={mine ? undefined : 'Long press to report this message'}
      style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
      <AppText style={{ color: mine ? colors.textOnPrimary : colors.text }}>{message.body}</AppText>
      <AppText variant="caption" style={{ color: mine ? colors.primarySoft : colors.textMuted, alignSelf: 'flex-end' }}>
        {timeAgo(message.created_at)}
      </AppText>
    </Pressable>
  );
}

const USER_REPORT_REASONS = [
  { value: 'scam', label: 'Scam or fraud attempt' },
  { value: 'harassment', label: 'Harassment or threats' },
  { value: 'offensive', label: 'Offensive language' },
  { value: 'spam', label: 'Spam' },
  { value: 'other', label: 'Something else' },
];

function ReportUserSheet({ userId, messageId, onClose }: { userId: string; messageId?: string; onClose: () => void }) {
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reason) {
      setError('Choose a reason.');
      return;
    }
    setState('sending');
    try {
      await reportUser(userId, reason, details, messageId);
      setState('done');
    } catch (e) {
      setState('idle');
      setError(e instanceof Error ? e.message : 'Could not send the report.');
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <AppText variant="title" style={{ flex: 1 }}>
            {messageId ? 'Report this message' : 'Report this person'}
          </AppText>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} onPress={onClose}>
            <Ionicons name="close" size={28} color={colors.text} />
          </Pressable>
        </View>
        {state === 'done' ? (
          <>
            <Notice title="Thank you. Your report was sent to the Mojere Market team." />
            <Button label="Done" onPress={onClose} />
          </>
        ) : (
          <>
            <AppText muted>Reports are private. Staff may read this conversation to investigate.</AppText>
            {USER_REPORT_REASONS.map((r) => (
              <Pressable
                key={r.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: reason === r.value }}
                onPress={() => setReason(r.value)}
                style={[styles.option, reason === r.value && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}>
                <Ionicons name={reason === r.value ? 'radio-button-on' : 'radio-button-off'} size={22} color={colors.primary} />
                <AppText>{r.label}</AppText>
              </Pressable>
            ))}
            <TextField label="More details (optional)" multiline maxLength={1000} value={details} onChangeText={setDetails} />
            {error ? <Notice tone="danger" title={error} /> : null}
            <Button label="Send report" onPress={() => void submit()} loading={state === 'sending'} />
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  itemBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemThumb: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.primarySoft },
  offer: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1, paddingHorizontal: spacing.sm },
  bubble: { maxWidth: '80%', borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 2 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: MIN_TOUCH,
    maxHeight: 120,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.body,
    color: colors.text,
  },
  send: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: MIN_TOUCH / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  menu: { backgroundColor: colors.background, padding: spacing.lg, gap: spacing.sm, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 48,
  },
});
