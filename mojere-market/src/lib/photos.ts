import { decode } from 'base64-arraybuffer';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from './supabase';

export const MAX_PHOTOS = 10;
/** Longest side after compression. Sharp on phones, small enough for mobile data. */
const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.7;

/** A photo in a listing form: either already uploaded (`path`) or newly picked (`uri`). */
export type PhotoItem = { key: string; path?: string; uri?: string };

export type PickResult = { ok: true; uris: string[] } | { ok: false; message: string };

export async function pickFromLibrary(remaining: number): Promise<PickResult> {
  if (remaining <= 0) return { ok: false, message: `You can add up to ${MAX_PHOTOS} photos.` };
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return { ok: false, message: 'Allow photo access in your phone settings to add pictures.' };
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: remaining,
    quality: 1,
  });
  if (result.canceled) return { ok: true, uris: [] };
  return { ok: true, uris: result.assets.slice(0, remaining).map((a) => a.uri) };
}

export async function takePhoto(): Promise<PickResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    return { ok: false, message: 'Allow camera access in your phone settings to take pictures.' };
  }
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
  if (result.canceled) return { ok: true, uris: [] };
  return { ok: true, uris: result.assets.map((a) => a.uri) };
}

/** Shrink and convert to JPEG. Returns the bytes and final size. */
export async function compressPhoto(uri: string) {
  const context = ImageManipulator.manipulate(uri);
  const loaded = await context.renderAsync();
  if (Math.max(loaded.width, loaded.height) > MAX_DIMENSION) {
    context.resize(loaded.width >= loaded.height ? { width: MAX_DIMENSION } : { height: MAX_DIMENSION });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY, base64: true });
  if (!saved.base64) throw new Error('Could not prepare the photo.');
  return { bytes: decode(saved.base64), width: saved.width, height: saved.height };
}

function randomId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Compress and upload one photo into the user's own folder in the
 * `listing-images` bucket (the storage rules only allow that folder).
 */
export async function uploadListingPhoto(userId: string, uri: string) {
  if (!supabase) throw new Error('Supabase is not configured yet.');
  const { bytes, width, height } = await compressPhoto(uri);
  const path = `${userId}/${randomId()}.jpg`;
  const { error } = await supabase.storage
    .from('listing-images')
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);
  return { path, width, height };
}

export async function removeListingPhotos(paths: string[]) {
  if (!supabase || paths.length === 0) return;
  // Best effort: a leftover file is harmless, but never block the user on it.
  await supabase.storage.from('listing-images').remove(paths);
}
