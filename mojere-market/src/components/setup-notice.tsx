import { supabaseConfig } from '@/lib/supabase-config';

import { AppText, Notice } from './ui';

/**
 * Shown at the top of screens that need the database. It tells the truth:
 * if Supabase is not connected, the feature cannot work yet.
 */
export function SetupNotice() {
  if (supabaseConfig.status === 'ready') return null;

  if (supabaseConfig.status === 'invalid') {
    return (
      <Notice tone="danger" title="Supabase setting problem">
        <AppText variant="small">{supabaseConfig.problem}</AppText>
      </Notice>
    );
  }

  return (
    <Notice tone="warning" title="Not connected to the database yet">
      <AppText variant="small">
        This is a setup preview. Marketplace features switch on after your Supabase project is
        connected (Phase 2). Missing setting{supabaseConfig.missing.length > 1 ? 's' : ''}:{' '}
        {supabaseConfig.missing.join(', ')}.
      </AppText>
    </Notice>
  );
}
