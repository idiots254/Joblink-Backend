export function getPublicAssetUrl(path) {
  if (!path) return path;

  const publicUrl = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
  if (!publicUrl) {
    return path.startsWith('/') ? `./${path.replace(/^\//, '')}` : path;
  }

  return path.startsWith('/') ? `${publicUrl}${path}` : `${publicUrl}/${path}`;
}
