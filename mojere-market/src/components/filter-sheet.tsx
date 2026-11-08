import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CONDITIONS, type Condition } from '@/constants/catalog';
import { formatNaira, parseNairaToKobo } from '@/lib/format';
import type { SortOption } from '@/lib/listings';
import { useLocations } from '@/lib/profile';
import { colors, radius, spacing } from '@/theme';

import { SelectField, TextField } from './form';
import { AppText, Button } from './ui';

export type FilterValues = {
  lgaId: string | null;
  minKobo: number | null;
  maxKobo: number | null;
  conditions: Condition[];
  sort: SortOption;
};

export const EMPTY_FILTERS: FilterValues = { lgaId: null, minKobo: null, maxKobo: null, conditions: [], sort: 'newest' };

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Lowest price' },
  { value: 'price_desc', label: 'Highest price' },
];

export function countActiveFilters(f: FilterValues) {
  return (f.lgaId ? 1 : 0) + (f.minKobo != null ? 1 : 0) + (f.maxKobo != null ? 1 : 0) + (f.conditions.length ? 1 : 0);
}

const nairaText = (kobo: number | null) => (kobo == null ? '' : String(kobo / 100));

/** Mount this only while it is open, so it always starts from the current filters. */
export function FilterSheet({
  visible,
  value,
  onApply,
  onClose,
}: {
  visible: boolean;
  value: FilterValues;
  onApply: (v: FilterValues) => void;
  onClose: () => void;
}) {
  const locations = useLocations();
  const [draft, setDraft] = useState(value);
  const [minText, setMinText] = useState(nairaText(value.minKobo));
  const [maxText, setMaxText] = useState(nairaText(value.maxKobo));
  const [error, setError] = useState<string | null>(null);

  const lgas = useMemo(
    () => (locations.data ?? []).filter((l) => l.kind === 'lga').map((l) => ({ value: l.id, label: l.name })),
    [locations.data],
  );

  function apply() {
    const min = minText.trim() ? parseNairaToKobo(minText) : null;
    const max = maxText.trim() ? parseNairaToKobo(maxText) : null;
    if ((minText.trim() && min == null) || (maxText.trim() && max == null)) {
      setError('Enter prices as numbers, e.g. 5000.');
      return;
    }
    if (min != null && max != null && min > max) {
      setError(`The minimum (${formatNaira(min)}) is higher than the maximum (${formatNaira(max)}).`);
      return;
    }
    onApply({ ...draft, minKobo: min, maxKobo: max });
  }

  function toggleCondition(c: Condition) {
    setDraft((d) => ({
      ...d,
      conditions: d.conditions.includes(c) ? d.conditions.filter((x) => x !== c) : [...d.conditions, c],
    }));
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={styles.header}>
          <AppText variant="title" style={{ flex: 1 }}>
            Filter and sort
          </AppText>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} onPress={onClose}>
            <Ionicons name="close" size={28} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: spacing.sm }}>
            <AppText variant="small" style={{ fontWeight: '600' }}>
              Sort by
            </AppText>
            <View style={styles.chips}>
              {SORT_OPTIONS.map((s) => (
                <Chip key={s.value} label={s.label} selected={draft.sort === s.value} onPress={() => setDraft({ ...draft, sort: s.value })} />
              ))}
            </View>
          </View>

          <SelectField
            label="Location"
            value={draft.lgaId}
            options={lgas}
            onChange={(v) => setDraft({ ...draft, lgaId: v })}
            allowClear
            placeholder="Anywhere in Ondo State"
          />

          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <TextField label="Min price (₦)" keyboardType="number-pad" value={minText} onChangeText={setMinText} placeholder="0" />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Max price (₦)" keyboardType="number-pad" value={maxText} onChangeText={setMaxText} placeholder="Any" />
            </View>
          </View>

          <View style={{ gap: spacing.sm }}>
            <AppText variant="small" style={{ fontWeight: '600' }}>
              Condition
            </AppText>
            <View style={styles.chips}>
              {CONDITIONS.map((c) => (
                <Chip key={c.value} label={c.label} selected={draft.conditions.includes(c.value)} onPress={() => toggleCondition(c.value)} />
              ))}
            </View>
          </View>

          {error ? (
            <AppText variant="small" style={{ color: colors.danger }}>
              {error}
            </AppText>
          ) : null}

          <Button label="Show results" onPress={apply} />
          <Button
            label="Clear all filters"
            kind="outline"
            onPress={() => {
              setDraft(EMPTY_FILTERS);
              setMinText('');
              setMaxText('');
              setError(null);
            }}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}>
      <AppText variant="small" style={{ color: selected ? colors.textOnPrimary : colors.text, fontWeight: '600' }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
});
