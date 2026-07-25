import { shouldRouteToAccountSelector, getAuthRedirectTarget, getFallbackRoute, getLandingEntryRoute, shouldClearStaleAuthFlags, shouldRedirectAwayFromLogin, shouldHandleAuthCallback, shouldDeferAuthRedirect } from './authRouting';

describe('auth routing', () => {
  it('routes missing profiles back to account selector', () => {
    expect(shouldRouteToAccountSelector(null)).toBe(true);
    expect(shouldRouteToAccountSelector({})).toBe(true);
  });

  it('routes existing profiles to home when the profile row exists and belongs to the signed-in user', () => {
    const profile = {
      id: 'user-2',
      email: 'user@example.com',
      user_type: 'employee',
      full_name: 'Jane Doe',
    };
    const minimalProfile = {
      id: 'user-2',
    };

    expect(shouldRouteToAccountSelector(profile, null, 'user-2')).toBe(false);
    expect(shouldRouteToAccountSelector(profile, null, 'user-3')).toBe(true);
    expect(shouldRouteToAccountSelector(minimalProfile, null, 'user-2')).toBe(true);
  });

  it('routes users to account selector when profile lookup fails unexpectedly', () => {
    const error = { code: 'PGRST301', message: 'Unexpected failure' };
    expect(shouldRouteToAccountSelector(null, error)).toBe(true);
  });

  it('returns the correct redirect target for the startup boot path', () => {
    expect(getAuthRedirectTarget(null, null, 'user-1')).toBe('/account-type-selector');
    expect(getAuthRedirectTarget({ id: 'user-1' }, null, 'user-1')).toBe('/account-type-selector');
    expect(getAuthRedirectTarget({ id: 'user-2' }, null, 'user-1')).toBe('/account-type-selector');
  });

  it('routes unknown paths back to the landing page instead of leaving the app blank', () => {
    expect(getFallbackRoute('/unknown')).toBe('/');
    expect(getFallbackRoute('/login')).toBe('/login');
    expect(getFallbackRoute('/auth/callback')).toBe('/auth/callback');
    expect(getFallbackRoute('/home')).toBe('/home');
  });

  it('clears stale auth flags when there is no active session', () => {
    expect(shouldClearStaleAuthFlags({ hasSession: false, oauthInProgress: true, authCached: false })).toBe(true);
    expect(shouldClearStaleAuthFlags({ hasSession: false, oauthInProgress: false, authCached: true })).toBe(true);
    expect(shouldClearStaleAuthFlags({ hasSession: true, oauthInProgress: true, authCached: false })).toBe(false);
    expect(shouldClearStaleAuthFlags({ hasSession: true, oauthInProgress: false, authCached: true })).toBe(false);
  });

  it('uses the login screen as the landing entry route', () => {
    expect(getLandingEntryRoute()).toBe('/login');
  });

  it('keeps the login screen visible when auth is cached but no session is actually authenticated', () => {
    expect(shouldRedirectAwayFromLogin({ isAuthenticated: false, authCached: true, hasSession: false })).toBe(false);
    expect(shouldRedirectAwayFromLogin({ isAuthenticated: true, authCached: true, hasSession: true })).toBe(true);
  });

  it('detects OAuth callback params that arrive in the hash fragment', () => {
    expect(shouldHandleAuthCallback({ pathname: '/', hash: '#access_token=abc' })).toBe(true);
    expect(shouldHandleAuthCallback({ pathname: '/', search: '?code=abc' })).toBe(true);
    expect(shouldHandleAuthCallback({ pathname: '/login', hash: '#section' })).toBe(false);
  });

  it('defers redirect away from login while auth state is still restoring', () => {
    expect(shouldDeferAuthRedirect({ isAuthenticated: false, isLoading: true })).toBe(true);
    expect(shouldDeferAuthRedirect({ isAuthenticated: false, isAwaitingCallback: true })).toBe(true);
    expect(shouldDeferAuthRedirect({ isAuthenticated: false, authCached: true })).toBe(true);
    expect(shouldDeferAuthRedirect({ isAuthenticated: false, authCached: false, oauthInProgress: true })).toBe(true);
    expect(shouldDeferAuthRedirect({ isAuthenticated: false, authCached: false, oauthInProgress: false })).toBe(false);
  });
});
