import { supabase } from './supabase';

/** The photo folders a person owns (each file is stored under `<their id>/`). */
export const PHOTO_BUCKETS = ['listing-images', 'profile-images', 'business-images'] as const;

/** The word the person must type before their account is deleted. */
export const DELETE_CONFIRM_WORD = 'DELETE';

/**
 * Permanently deletes the signed-in person's account.
 * 1. Removes their photos (the app may only delete files in its own folder).
 * 2. Asks the server to delete the account and everything linked to it.
 *    The server refuses staff accounts and anything not confirmed with DELETE.
 * 3. Signs out on this phone.
 */
export async function deleteMyAccount(userId: string, confirmWord: string): Promise<void> {
  if (!supabase) throw new Error('The app is not connected to the database yet.');
  if (confirmWord.trim() !== DELETE_CONFIRM_WORD) throw new Error(`Please type ${DELETE_CONFIRM_WORD} to confirm.`);

  for (const bucket of PHOTO_BUCKETS) {
    const { data: files } = await supabase.storage.from(bucket).list(userId, { limit: 1000 });
    const paths = (files ?? []).filter((f) => f.name && f.id).map((f) => `${userId}/${f.name}`);
    if (paths.length > 0) await supabase.storage.from(bucket).remove(paths);
  }

  const { error } = await supabase.rpc('mm_delete_my_account', { p_confirm: DELETE_CONFIRM_WORD });
  if (error) throw new Error(error.message || 'Could not delete your account. Please try again.');

  // The account no longer exists on the server, so only clear this phone.
  await supabase.auth.signOut({ scope: 'local' });
}
