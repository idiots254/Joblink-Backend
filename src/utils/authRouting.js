export function shouldRouteToAccountSelector(profile, error = null, currentUserId = null) {
  if (error) {
    return true;
  }

  if (!profile || typeof profile !== 'object') return true;

  const hasProfileId = Boolean(profile.id);
  if (!hasProfileId) {
    return true;
  }

  const normalizedProfileId = String(profile.id);
  const normalizedCurrentUserId = currentUserId == null ? null : String(currentUserId);
  if (normalizedCurrentUserId && normalizedProfileId !== normalizedCurrentUserId) {
    return true;
  }

  // A profile row is only considered complete when onboarding has finished.
  // If user_type is not set, the user should be sent to account selector.
  if (!profile.user_type) {
    return true;
  }

  return false;
}

export function getAuthRedirectTarget(profile, error = null, currentUserId = null) {
  return shouldRouteToAccountSelector(profile, error, currentUserId)
    ? '/account-type-selector'
    : '/home';
}

export function getFallbackRoute(pathname) {
  if (typeof pathname !== 'string' || pathname.trim() === '') {
    return '/';
  }

  const normalizedPath = pathname.trim();
  if (normalizedPath === '/' || normalizedPath === '/landing') {
    return '/';
  }

  const publicRoutes = ['/login', '/terms', '/privacy', '/auth/callback'];
  if (publicRoutes.includes(normalizedPath)) {
    return normalizedPath;
  }

  if (normalizedPath.startsWith('/profile/')) {
    return normalizedPath;
  }

  if (normalizedPath === '/account-type-selector' || normalizedPath === '/home') {
    return normalizedPath;
  }

  return '/';
}

export function getLandingEntryRoute() {
  return '/login';
}

export function shouldClearStaleAuthFlags({ hasSession, oauthInProgress, authCached } = {}) {
  return !hasSession && (oauthInProgress === true || authCached === true);
}

export function shouldRedirectAwayFromLogin({ isAuthenticated, authCached, hasSession } = {}) {
  if (isAuthenticated) {
    return true;
  }

  if (!hasSession && authCached) {
    return false;
  }

  return Boolean(hasSession);
}

export function shouldDeferAuthRedirect({ isAuthenticated = false, isLoading = false, isAwaitingCallback = false, authCached = false, oauthInProgress = false } = {}) {
  if (isAuthenticated) {
    return false;
  }

  if (isLoading || isAwaitingCallback) {
    return true;
  }

  if (authCached || oauthInProgress) {
    return true;
  }

  return false;
}

export function shouldHandleAuthCallback({ pathname = '', hash = '', search = '' } = {}) {
  const normalizedPath = String(pathname || '').trim();
  if (normalizedPath === '/auth/callback') {
    return true;
  }

  const rawQuery = String(hash || '').startsWith('#') ? String(hash).slice(1) : String(search || '').replace(/^[?]/, '');
  if (!rawQuery) {
    return false;
  }

  const params = new URLSearchParams(rawQuery);
  return (
    params.has('access_token') ||
    params.has('refresh_token') ||
    params.has('code') ||
    params.has('error_description') ||
    params.has('error')
  );
}
