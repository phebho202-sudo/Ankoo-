import { useMemo, useState } from 'react';
import { ActivityIndicator, Switch, View } from 'react-native';

import { AdminGate } from '@/components/admin-ui';
import { Chip } from '@/components/filter-sheet';
import { SelectField, TextField } from '@/components/form';
import { AppText, Button, Card, Notice, Screen } from '@/components/ui';
import { useAdminTableEdit, useAllCategories, useAppSettings, useMeetupSpots } from '@/lib/admin';
import { slugify } from '@/lib/business';
import { useLocations } from '@/lib/profile';
import { colors, spacing } from '@/theme';

type Tab = 'categories' | 'places' | 'meetup' | 'settings';

function Toggle({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: spacing.xs }}>
      <AppText style={{ flex: 1 }}>{label}</AppText>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: colors.primary, false: colors.border }} />
    </View>
  );
}

function Catalog() {
  const [tab, setTab] = useState<Tab>('categories');
  const edit = useAdminTableEdit();
  const categories = useAllCategories();
  const locations = useLocations();
  const meetups = useMeetupSpots(null, true);
  const settings = useAppSettings();
  const [message, setMessage] = useState<{ tone: 'info' | 'danger'; text: string } | null>(null);

  const [newCategory, setNewCategory] = useState('');
  const [townLga, setTownLga] = useState<string | null>(null);
  const [townName, setTownName] = useState('');
  const [spotLga, setSpotLga] = useState<string | null>(null);
  const [spotName, setSpotName] = useState('');
  const [spotDescription, setSpotDescription] = useState('');

  const lgas = useMemo(() => (locations.data ?? []).filter((l) => l.kind === 'lga').map((l) => ({ value: l.id, label: l.name })), [locations.data]);
  const lgaName = (id: string | null) => lgas.find((l) => l.value === id)?.label ?? '';

  async function run(work: Promise<unknown>, success: string) {
    setMessage(null);
    try {
      await work;
      setMessage({ tone: 'info', text: `${success} Recorded in the audit log.` });
    } catch (e) {
      const text = e instanceof Error ? e.message : 'Could not save.';
      setMessage({ tone: 'danger', text: text.includes('duplicate') ? 'That name already exists.' : text });
    }
  }

  const requireApproval = settings.data?.listings_require_approval === true;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Chip label="Categories" selected={tab === 'categories'} onPress={() => setTab('categories')} />
        <Chip label="Towns" selected={tab === 'places'} onPress={() => setTab('places')} />
        <Chip label="Safe meetup spots" selected={tab === 'meetup'} onPress={() => setTab('meetup')} />
        <Chip label="Settings" selected={tab === 'settings'} onPress={() => setTab('settings')} />
      </View>
      {message ? <Notice tone={message.tone} title={message.text} /> : null}

      {tab === 'categories' ? (
        <>
          <Card>
            <AppText variant="title">Add a category</AppText>
            <TextField label="Name" value={newCategory} onChangeText={setNewCategory} />
            <Button
              label="Add category"
              disabled={newCategory.trim().length < 2}
              loading={edit.isPending}
              onPress={() =>
                void run(
                  edit.mutateAsync({
                    table: 'categories',
                    values: { name: newCategory.trim(), slug: slugify(newCategory), icon: 'pricetag-outline', sort_order: (categories.data?.length ?? 0) + 1 },
                  }).then(() => setNewCategory('')),
                  'Category added.',
                )
              }
            />
          </Card>
          <Card>
            <AppText variant="title">Show or hide categories</AppText>
            <AppText variant="caption">Hidden categories disappear from browsing and selling. Existing listings are kept.</AppText>
            {categories.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
            {(categories.data ?? []).map((c) => (
              <Toggle
                key={c.id}
                label={c.name}
                value={c.is_active}
                disabled={edit.isPending}
                onChange={(v) => void run(edit.mutateAsync({ table: 'categories', id: c.id, values: { is_active: v } }), `${c.name} ${v ? 'shown' : 'hidden'}.`)}
              />
            ))}
          </Card>
        </>
      ) : null}

      {tab === 'places' ? (
        <Card>
          <AppText variant="title">Add a town or neighbourhood</AppText>
          <AppText variant="caption">The 18 Ondo State LGAs are fixed. Add towns and areas inside them, e.g. “FUTA South Gate”.</AppText>
          <SelectField label="LGA" value={townLga} options={lgas} onChange={setTownLga} />
          <TextField label="Town or area name" value={townName} onChangeText={setTownName} />
          <Button
            label="Add town"
            disabled={!townLga || townName.trim().length < 2}
            loading={edit.isPending}
            onPress={() =>
              void run(
                edit.mutateAsync({
                  table: 'locations',
                  values: { name: townName.trim(), slug: `${slugify(townName)}-${slugify(lgaName(townLga)).slice(0, 12)}`, kind: 'town', parent_id: townLga },
                }).then(() => setTownName('')),
                'Town added.',
              )
            }
          />
          {townLga ? (
            <View style={{ gap: spacing.xs }}>
              <AppText variant="small" style={{ fontWeight: '600' }}>
                Towns in {lgaName(townLga)}
              </AppText>
              {(locations.data ?? [])
                .filter((l) => l.parent_id === townLga)
                .map((t) => (
                  <AppText key={t.id} variant="small">
                    • {t.name}
                  </AppText>
                ))}
            </View>
          ) : null}
        </Card>
      ) : null}

      {tab === 'meetup' ? (
        <>
          <Card>
            <AppText variant="title">Add a safe meetup spot</AppText>
            <AppText variant="caption">
              Busy, well-lit public places, e.g. a bank hall or shopping plaza. These are suggested to buyers and sellers on item pages. Only add places
              you know are suitable.
            </AppText>
            <SelectField label="LGA" value={spotLga} options={lgas} onChange={setSpotLga} />
            <TextField label="Place name" value={spotName} onChangeText={setSpotName} />
            <TextField label="Tip (optional)" value={spotDescription} onChangeText={setSpotDescription} placeholder="e.g. Meet near the main entrance, daytime" />
            <Button
              label="Add spot"
              disabled={!spotLga || spotName.trim().length < 3}
              loading={edit.isPending}
              onPress={() =>
                void run(
                  edit.mutateAsync({
                    table: 'meetup_locations',
                    values: { lga_id: spotLga, name: spotName.trim(), description: spotDescription.trim() || null },
                  }).then(() => {
                    setSpotName('');
                    setSpotDescription('');
                  }),
                  'Meetup spot added.',
                )
              }
            />
          </Card>
          <Card>
            <AppText variant="title">All spots</AppText>
            {(meetups.data ?? []).map((m) => (
              <Toggle
                key={m.id}
                label={`${m.name} (${lgaName(m.lga_id)})`}
                value={m.is_active}
                disabled={edit.isPending}
                onChange={(v) => void run(edit.mutateAsync({ table: 'meetup_locations', id: m.id, values: { is_active: v } }), 'Updated.')}
              />
            ))}
            {meetups.isSuccess && !meetups.data.length ? <AppText muted>No spots yet.</AppText> : null}
          </Card>
        </>
      ) : null}

      {tab === 'settings' ? (
        <Card>
          <AppText variant="title">Listing review</AppText>
          <Toggle
            label="New listings need approval before they go live"
            value={requireApproval}
            disabled={edit.isPending || settings.isLoading}
            onChange={(v) =>
              void run(
                edit.mutateAsync({ table: 'app_settings', id: 'listings_require_approval', idColumn: 'key', values: { value: v } }),
                v ? 'New listings now wait for approval.' : 'New listings now go live straight away.',
              )
            }
          />
          <AppText variant="caption">
            Off: listings appear immediately and staff remove problems after reports. On: every new or edited-after-rejection listing waits in
            Admin → Listings → Waiting for review.
          </AppText>
        </Card>
      ) : null}
    </Screen>
  );
}

export default function AdminCatalogScreen() {
  return (
    <AdminGate adminOnly>
      <Catalog />
    </AdminGate>
  );
}
