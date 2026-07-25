import { supabase, MEDIA_BUCKET } from '../supabase';
import { API_URL } from '../config';

const MAX_MEDIA_SIZE_BYTES = 50 * 1024 * 1024;
const ALLOWED_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/ogg',
  'application/pdf'
]);

const sanitizeFileName = (fileName = 'media') => {
  const baseName = String(fileName)
    .replace(/\\/g, '/')
    .split('/')
    .pop() || 'media';

  const sanitized = baseName
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return sanitized || 'media';
};

export async function uploadMediaFileToSupabase(file, userId) {
  if (!file) {
    throw new Error('No media file was selected.');
  }

  if (!ALLOWED_MEDIA_TYPES.has(file.type)) {
    throw new Error('Unsupported media type. Allowed: images, video, PDF.');
  }

  if (file.size > MAX_MEDIA_SIZE_BYTES) {
    throw new Error('Media file must be 50MB or smaller.');
  }

  const safeUserId = String(userId || 'anonymous').trim();
  const timestamp = Date.now();
  const safeName = sanitizeFileName(file.name || `media-${timestamp}`);
  const path = `${safeUserId}/${timestamp}-${safeName}`;

  console.log('📤 Uploading media file to Supabase:', { path, fileType: file.type, fileSize: file.size });

  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || 'application/octet-stream'
    });

  if (error) {
    console.error('❌ Media upload error:', error);

    const message = error?.message || 'Failed to upload media file.';

    const fallbackToServer = async () => {
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

      const resp = await fetch(`${API_URL}/api/account/media-upload`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ filename: file.name || 'media', mimeType: file.type || 'application/octet-stream', base64 })
      });

      if (!resp.ok) {
        const payload = await resp.json().catch(() => null);
        throw new Error((payload && payload.error) ? payload.error : `Server upload failed: ${resp.statusText}`);
      }

      const data = await resp.json();
      return { path: data.path, publicUrl: data.publicUrl || null };
    };

    if (/row-level security|violates row-level security|Bucket not found/i.test(message)) {
      try {
        console.log('⚠️ Falling back to server-side media upload due to storage error');
        return await fallbackToServer();
      } catch (fallbackErr) {
        throw new Error(fallbackErr?.message || 'Failed to upload media via server fallback.');
      }
    }

    throw new Error(message || 'Failed to upload media file.');
  }

  console.log('✅ Media uploaded successfully:', { path, data });

  const { data: publicUrlData } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);

  console.log('🔗 Public URL:', publicUrlData?.publicUrl);

  return {
    path,
    publicUrl: publicUrlData?.publicUrl || null
  };
}
