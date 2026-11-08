import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { listingImageUrl } from '@/lib/listings';
import { MAX_PHOTOS, pickFromLibrary, takePhoto, type PhotoItem } from '@/lib/photos';
import { colors, radius, spacing } from '@/theme';

import { AppText, Button } from './ui';

let counter = 0;
const newKey = () => `new-${Date.now()}-${counter++}`;

export function PhotoPicker({
  photos,
  onChange,
  error,
}: {
  photos: PhotoItem[];
  onChange: (p: PhotoItem[]) => void;
  error?: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const remaining = MAX_PHOTOS - photos.length;

  async function add(source: 'camera' | 'library') {
    setMessage(null);
    try {
      const result = source === 'camera' ? await takePhoto() : await pickFromLibrary(remaining);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      const added = result.uris.slice(0, remaining).map((uri) => ({ key: newKey(), uri }));
      if (added.length) onChange([...photos, ...added]);
    } catch {
      setMessage('Could not open your photos. Please try again.');
    }
  }

  function remove(key: string) {
    onChange(photos.filter((p) => p.key !== key));
  }

  function makeCover(key: string) {
    const chosen = photos.find((p) => p.key === key);
    if (!chosen) return;
    onChange([chosen, ...photos.filter((p) => p.key !== key)]);
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="small" style={{ fontWeight: '600' }}>
        Photos ({photos.length}/{MAX_PHOTOS})
      </AppText>
      <AppText variant="caption">
        Clear, bright photos sell faster. The first photo is the cover. Tap a photo to make it the cover.
      </AppText>

      {photos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {photos.map((p, i) => {
            const uri = p.uri ?? listingImageUrl(p.path) ?? undefined;
            return (
              <View key={p.key}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={i === 0 ? 'Cover photo' : `Photo ${i + 1}. Make cover`}
                  onPress={() => makeCover(p.key)}>
                  <Image source={uri ? { uri } : undefined} style={styles.thumb} contentFit="cover" />
                </Pressable>
                {i === 0 ? (
                  <View style={styles.coverTag}>
                    <AppText variant="caption" style={{ color: colors.textOnPrimary, fontWeight: '700' }}>
                      Cover
                    </AppText>
                  </View>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove photo ${i + 1}`}
                  hitSlop={8}
                  onPress={() => remove(p.key)}
                  style={styles.remove}>
                  <Ionicons name="close" size={16} color={colors.textOnPrimary} />
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      ) : null}

      {remaining > 0 ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button label="Take photo" kind="outline" onPress={() => void add('camera')} style={{ flex: 1 }} />
          <Button label="Choose photos" kind="outline" onPress={() => void add('library')} style={{ flex: 1 }} />
        </View>
      ) : null}
      {message || error ? (
        <AppText variant="caption" style={{ color: colors.danger }}>
          {message ?? error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 96, height: 96, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  coverTag: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
  },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
