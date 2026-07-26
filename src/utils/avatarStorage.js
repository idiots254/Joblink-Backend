import { supabase, AVATAR_BUCKET } from '../supabase';
import { API_URL } from '../config';

const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const sanitizeFileName = (fileName = 'avatar') => {
  const baseName = String(fileName).replace(/\\/g, '/').split('/').pop() || 'avatar';

  const sanitized = baseName
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return sanitized || 'avatar';
};

export function buildAvatarStoragePath(filename = 'avatar', userId) {
  const safeUserId = String(userId || 'anonymous').trim() || 'anonymous';
  const safeFilename = String(filename || 'avatar')
    .replace(/\\/g, '/')
    .split('/')
    .pop() || 'avatar';
  const sanitizedBaseName = safeFilename
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  const cleanFileName = sanitizedBaseName || 'avatar';
  const timestamp = Date.now();
  return `${safeUserId}/${timestamp}-${cleanFileName}`;
}

export async function uploadAvatarToSupabase(file, userId) {
  if (!file) throw new Error('No image file was selected.');
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error('Only JPG, PNG, WEBP, or GIF images are supported.');
  if (file.size > MAX_AVATAR_SIZE_BYTES) throw new Error('Avatar image must be 2MB or smaller.');

  const path = buildAvatarStoragePath(file.name, userId);

  try {
    const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || 'image/jpeg',
    });

    if (!error) {
      const { data: publicUrlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      return { path, publicUrl: publicUrlData?.publicUrl || null };
    }

    console.warn('Direct avatar upload to Supabase failed, falling back to server route:', error?.message || error);
  } catch (directErr) {
    console.warn('Direct avatar upload threw, falling back to server route:', directErr?.message || directErr);
  }

  try {
    const toBase64 = (fileBlob) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result || '';
        const parts = String(result).split(',');
        resolve(parts[1] || '');
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(fileBlob);
    });

    const base64 = await toBase64(file);

    let headers = { 'Content-Type': 'application/json' };
    try {
      const { data: { session } = {} } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) headers['Authorization'] = `Bearer ${token}`;
    } catch (e) {
      // ignore
    }

    const resp = await fetch(`${API_URL}/api/account/avatar-upload`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ filename: file.name || 'avatar', mimeType: file.type || 'image/jpeg', base64 }),
    });

    if (!resp.ok) {
      const payload = await resp.json().catch(() => null);
      throw new Error((payload && payload.error) ? payload.error : `Server upload failed: ${resp.statusText}`);
    }

    const data = await resp.json();
    return { path: data.path, publicUrl: data.publicUrl || null };
  } catch (fallbackErr) {
    throw new Error(fallbackErr?.message || 'Failed to upload avatar via server fallback.');
  }
}
