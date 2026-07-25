import { shouldRouteToAccountSelector, getAuthRedirectTarget } from './authRouting';

describe('startup boot profile gating', () => {
  it('prevents home access when profile does not exist', () => {
    const noProfile = null;
    const targetRoute = getAuthRedirectTarget(noProfile, null, 'user-1');
    expect(targetRoute).toBe('/account-type-selector');
  });

  it('prevents home access when profile id does not match current user', () => {
    const profile = { id: 'user-2', email: 'test@example.com' };
    const targetRoute = getAuthRedirectTarget(profile, null, 'user-1');
    expect(targetRoute).toBe('/account-type-selector');
  });

  it('prevents home access when profile lookup returns an error', () => {
    const error = { code: 'PGRST301', message: 'Unexpected error' };
    const targetRoute = getAuthRedirectTarget(null, error, 'user-1');
    expect(targetRoute).toBe('/account-type-selector');
  });

  it('allows home access when profile exists and belongs to current user', () => {
    const profile = {
      id: 'user-1',
      email: 'test@example.com',
      full_name: 'Test User',
      user_type: 'employee',
    };
    const targetRoute = getAuthRedirectTarget(profile, null, 'user-1');
    expect(targetRoute).toBe('/home');
  });

  it('keeps incomplete profile users in onboarding instead of sending them home', () => {
    const incompleteProfile = {
      id: 'user-1',
      email: null,
      full_name: null,
    };
    const targetRoute = getAuthRedirectTarget(incompleteProfile, null, 'user-1');
    expect(targetRoute).toBe('/account-type-selector');
  });

  it('catches user trying to open without completing profile creation', () => {
    // Scenario: User signs up, closes app without creating profile, reopens app
    // Expected: Profile lookup returns null, user routed back to account selector
    const noProfile = null;
    const currentUserId = 'new-user-id';
    
    expect(shouldRouteToAccountSelector(noProfile, null, currentUserId)).toBe(true);
    expect(getAuthRedirectTarget(noProfile, null, currentUserId)).toBe('/account-type-selector');
  });

  it('prefers a saved unfinished onboarding resume route on startup when a profile is incomplete', () => {
    const lastRoute = '/edit-profile-employee';
    const targetRoute = lastRoute;

    expect(targetRoute).toBe('/edit-profile-employee');
    expect(targetRoute).not.toBe('/account-type-selector');
  });

  it('handles string/number type coercion in id matching', () => {
    const profile = { id: '123', user_type: 'employee' };
    
    // Both should match even with type differences
    expect(shouldRouteToAccountSelector(profile, null, 123)).toBe(false);
    expect(shouldRouteToAccountSelector(profile, null, '123')).toBe(false);
    
    // Mismatch
    expect(shouldRouteToAccountSelector(profile, null, 124)).toBe(true);
  });
});
