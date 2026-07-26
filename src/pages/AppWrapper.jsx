import React, { useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase';
import { Capacitor } from '@capacitor/core';
import { setSecure } from '../services/screenshotControl';
import { App as CapacitorApp } from '@capacitor/app';
import { NotificationProvider } from '../contexts/NotificationContext';
import ToastContainer from '../components/Toast/ToastContainer';
import RealtimeListener from '../components/Notifications/RealtimeListener';
import Login from '../Login';
import AuthCallback from '../Login/AuthCallback';
import TermsPage from '../Settings/TermsPage';
import PrivacyPolicyPage from '../Settings/PrivacyPolicyPage';
import Landing from '../Landing/Landing';
import JobLink from './JobLink';
import FollowLikeListPage from '../components/FollowLikeListPage';
import MediaDebugPanel from './MediaDebugPanel';
import { getFallbackRoute, getLandingEntryRoute, shouldClearStaleAuthFlags, shouldHandleAuthCallback, shouldDeferAuthRedirect } from '../utils/authRouting';
import { getPublicAssetUrl } from '../utils/publicAssetUrl';
import { initViewportHeight } from '../utils/viewport';

const normalizePendingRoute = (route) => {
  if (typeof route !== 'string') return '';
  let normalized = route.trim();
  if (normalized.startsWith('#')) {
    normalized = normalized.slice(1);
  }
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  if (normalized.length > 1) {
    normalized = normalized.replace(/\/+$|\s+$/g, '');
  }
  return normalized;
};

const getPendingResumeRoute = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const savedLastRoute = localStorage.getItem('joblinkLastRoute');
    const draftRaw = localStorage.getItem('joblinkPendingProfileDraft');
    const draft = draftRaw ? JSON.parse(draftRaw) : null;

    const routeFromDraft = draft?.accountType
      ? `/edit-profile-${draft.accountType}`
      : null;

    const saved = normalizePendingRoute(savedLastRoute);
    const route = routeFromDraft || saved;

    console.log('🔄 [getPendingResumeRoute] Checking for pending resume:', {
      savedLastRoute,
      normalizedSaved: saved,
      draft: draft ? `{accountType: ${draft.accountType}, ...}` : null,
      routeFromDraft,
      finalRoute: route,
    });

    if (!route || route === '/landing' || route === '/login' || route === '/auth/callback') {
      console.log('🔄 [getPendingResumeRoute] No valid onboarding route found');
      return null;
    }

    const isOnboardingRoute = /^\/edit-profile-(employee|employer)$/.test(route)
      || /^\/account-type-selector(?:\/step-[12])?$/.test(route);

    if (isOnboardingRoute) {
      console.log('🔄 [getPendingResumeRoute] Returning onboarding route:', route);
      return route;
    }

    console.log('🔄 [getPendingResumeRoute] Route not an onboarding route:', route);
    return null;
  } catch (e) {
    console.warn('AppWrapper failed to read pending resume route:', e);
    return null;
  }
};

function StartupLoadingFallback({ label = 'Loading' }) {
  return (
    <>
      <style>{`
        .startup-loading-fallback,
        .startup-loading-fallback * {
          text-transform: none !important;
        }
      `}</style>
      <div className="startup-loading-fallback" style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0b1216',
        color: '#fff',
        fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, letterSpacing: 1.1, textTransform: 'none', opacity: 0.75 }}>{label}</div>
        </div>
      </div>
    </>
  );
}

/**
 * Protected Route Component
 * Redirects to login if user is not authenticated
 */
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading, isAwaitingCallback, user, isSigningOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [hasCheckedAuth, setHasCheckedAuth] = React.useState(false);
  const redirectTimeoutRef = React.useRef(null);
  const [profileChecked, setProfileChecked] = React.useState(false);
  const profileCheckAbortRef = React.useRef(false);

  React.useEffect(() => {
    if (!isAuthenticated) {
      setProfileChecked(false);
      profileCheckAbortRef.current = false;
    }

    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
    }

    if ((isLoading || isAwaitingCallback) && !isSigningOut) {
      setHasCheckedAuth(false);
      return;
    }

    const shouldDeferRedirect = shouldDeferAuthRedirect({
      isAuthenticated,
      isLoading,
      isAwaitingCallback,
      authCached: Boolean(localStorage.getItem('_authCached') === 'true'),
      oauthInProgress: Boolean(localStorage.getItem('_oauthInProgress') === 'true'),
    });

    if (shouldDeferRedirect) {
      setHasCheckedAuth(false);
      return;
    }

    // If authenticated, verify profile completion before allowing access to protected app routes
    if (isAuthenticated) {
      // Skip profile verification for all onboarding routes
      const isOnboardingPath = /^\/(account-type-selector|edit-profile-(employee|employer))/.test(location.pathname);
      console.log('[ProtectedRoute] pathname check:', { pathname: location.pathname, isOnboardingPath });
      
      if (!profileChecked && !profileCheckAbortRef.current && !isOnboardingPath) {
        const verifyProfile = async () => {
          if (!user?.id) {
            setProfileChecked(true);
            return;
          }

          const readCachedMetadata = () => {
            try {
              const cached = localStorage.getItem('_profileMetadata');
              return cached ? JSON.parse(cached) : null;
            } catch (e) {
              return null;
            }
          };

          let meta = readCachedMetadata();
          const cacheIsValid = meta && String(meta.userId) === String(user.id);
          let needsOnboarding = true;

          if (cacheIsValid && meta.hasProfile && meta.user_type) {
            // Verify that cached profile actually exists and has required fields
            try {
              const { data: cachedProfile, error: cacheProfileError } = await supabase
                .from('profiles')
                .select('id, user_type, full_name, display_name, email')
                .eq('id', user.id)
                .maybeSingle();
              
              const hasRequiredFields = cachedProfile && (cachedProfile.full_name || cachedProfile.display_name || cachedProfile.email);
              if (!cacheProfileError && cachedProfile?.id && cachedProfile.user_type && hasRequiredFields) {
                // Cache is valid, profile exists with required fields
                needsOnboarding = false;
              } else {
                // Cache is stale or profile is incomplete, invalidate it
                meta = { hasProfile: false, user_type: null, userId: user.id };
                needsOnboarding = true;
              }
            } catch (e) {
              // On error, default to needing onboarding
              needsOnboarding = true;
              meta = { hasProfile: false, user_type: null, userId: user.id };
            }
          } else {
            try {
              const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('id, user_type, full_name, display_name, email')
                .eq('id', user.id)
                .maybeSingle();

              // Profile is only complete if it has required fields (not just an empty row)
              const hasRequiredFields = profile && (profile.full_name || profile.display_name || profile.email);
              if (!profileError && profile?.id && profile.user_type && hasRequiredFields) {
                needsOnboarding = false;
                meta = { hasProfile: true, user_type: profile.user_type, userId: user.id };
              } else {
                needsOnboarding = true;
                meta = { hasProfile: false, user_type: null, userId: user.id };
              }
            } catch (profileError) {
              console.warn('ProtectedRoute profile validation failed:', profileError);
            }
          }

          try {
            localStorage.setItem('_profileMetadata', JSON.stringify(meta || { hasProfile: false, user_type: null, userId: user.id }));
            localStorage.setItem('hasCompletedOnboarding', needsOnboarding ? 'false' : 'true');
          } catch (e) {
            console.warn('ProtectedRoute failed to persist profile metadata:', e);
          }

          if (needsOnboarding) {
            const pendingResumeRoute = getPendingResumeRoute();
            const targetRoute = pendingResumeRoute || '/account-type-selector';
            console.log('🛡️ [ProtectedRoute] Profile incomplete, navigating to:', targetRoute, {
              pendingResumeRoute,
              hasProfile: meta?.hasProfile,
              userType: meta?.user_type,
            });
            navigate(targetRoute, { replace: true });
          }

          setProfileChecked(true);
        };

        verifyProfile();
      }
      setHasCheckedAuth(true);
      return;
    }

    // If not authenticated, check session immediately and redirect faster.
    if (!hasCheckedAuth) {
      redirectTimeoutRef.current = true;
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          const oauthInProgress = localStorage.getItem('_oauthInProgress') === 'true';

          if (oauthInProgress || isAwaitingCallback) {
            setHasCheckedAuth(false);
            return;
          }

          try { localStorage.removeItem('_authCached'); } catch (e) {}
          setHasCheckedAuth(true);
          navigate('/login', { replace: true });
        } else {
          setHasCheckedAuth(false);
        }
      });
    }

    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, [isAuthenticated, isLoading, user, hasCheckedAuth, navigate, location.pathname, isSigningOut, profileChecked]);

  const authCached = typeof window !== 'undefined' && (
    localStorage.getItem('_authCached') === 'true' ||
    localStorage.getItem('_oauthInProgress') === 'true'
  );

  if (isLoading && !isSigningOut) {
    const isOnboardingPath = /^\/(account-type-selector|edit-profile-(employee|employer))/.test(location.pathname);
    console.log('[ProtectedRoute] isLoading check:', { pathname: location.pathname, isOnboardingPath });
    if (isOnboardingPath && (authCached || isAwaitingCallback)) {
      return children;
    }
    return <StartupLoadingFallback label="Loading" />;
  }

  if (!isAuthenticated) {
    const isOnboardingPath = /^\/(account-type-selector|edit-profile-(employee|employer))/.test(location.pathname);
    console.log('[ProtectedRoute] !isAuthenticated check:', { pathname: location.pathname, isOnboardingPath });
    if (isOnboardingPath && (authCached || isAwaitingCallback)) {
      return children;
    }
    return <StartupLoadingFallback label="Opening" />;
  }

  const cached = (() => {
    try {
      const raw = localStorage.getItem('_profileMetadata');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  })();

  const hasCachedCompleteProfile = Boolean(
    cached?.hasProfile &&
    cached?.user_type &&
    String(cached.userId) === String(user?.id)
  );

  if (!profileChecked) {
    const isOnboardingPath = /^\/(account-type-selector|edit-profile-(employee|employer))/.test(location.pathname);
    console.log('[ProtectedRoute] !profileChecked check:', { pathname: location.pathname, isOnboardingPath, hasCachedCompleteProfile });
    if (!isOnboardingPath && !hasCachedCompleteProfile) {
      return <StartupLoadingFallback label="Opening" />;
    }
  }

  if (isAuthenticated && user?.id) {

    const hasCompleteProfile = Boolean(cached?.hasProfile && cached?.user_type && String(cached.userId) === String(user.id));
    const protectedPaths = ['/home', '/profile', '/trending', '/following', '/liked', '/media-debug'];
    const isProtectedAppPath = protectedPaths.some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`));

    if (!hasCompleteProfile && isProtectedAppPath && location.pathname !== '/account-type-selector') {
      const pendingResumeRoute = getPendingResumeRoute();
      navigate(pendingResumeRoute || '/account-type-selector', { replace: true });
      return <StartupLoadingFallback label="Opening" />;
    }
  }

  return children;
}

/**
 * App Router Component
 * Handles routing between Login, Auth Callback, and main app
 */
function AppRouter() {
  const { isAuthenticated, isLoading, isSigningOut, isAwaitingCallback } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [authCached, setAuthCached] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('_authCached') === 'true';
  });  

  React.useEffect(() => {
    const currentCached = localStorage.getItem('_authCached') === 'true';
    if (currentCached !== authCached) {
      setAuthCached(currentCached);
    }
  }, [isAuthenticated, isLoading, authCached]);

  // Helper function to check if user has a complete profile and redirect accordingly
  const checkUserProfile = useCallback(async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.warn('Session check warning during profile redirect:', sessionError);
      }

      if (!session?.user?.id) {
        return;
      }

      // Check if user has a complete profile in the database (profile exists AND user_type is set)
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, user_type')
        .eq('id', session.user.id)
        .maybeSingle();
      
      // User needs onboarding if: no profile OR profile has no user_type
      const needsOnboarding = !profile?.id || !profile?.user_type;
      
      if (needsOnboarding) {
        localStorage.setItem('hasCompletedOnboarding', 'false');
        const pendingResumeRoute = getPendingResumeRoute();
        navigate(pendingResumeRoute || '/account-type-selector', { replace: true });
      } else {
        localStorage.setItem('hasCompletedOnboarding', 'true');
        const hashRoute = window.location.hash.slice(1);
        const targetRoute = (hashRoute && hashRoute !== '/' && hashRoute !== '/landing') ? hashRoute : '/home';
        navigate(targetRoute, { replace: true });
      }
    } catch (err) {
      navigate('/account-type-selector', { replace: true });
    }
  }, [navigate]);

  // Auto-redirect based on auth status
  useEffect(() => {
    if (isAwaitingCallback) {
      return;
    }

    if (location.pathname === '/auth/callback' || location.pathname === '/account-type-selector') {
      return;
    }

    if (isLoading && !isSigningOut) {
      return;
    }

    const clearStaleAuthCache = () => {
      if (localStorage.getItem('_authCached') === 'true') {
        try { localStorage.removeItem('_authCached'); } catch (e) {}
      }
    };

    // If auth was cached and we're still on login, check profile to redirect correctly
    if (isAwaitingCallback) {
      return;
    }

    if (location.pathname === '/login' && authCached) {
      checkUserProfile();
      return;
    }

    // If on landing and already authenticated, check if they have a profile
    if (isAuthenticated && location.pathname === '/') {
      checkUserProfile();
      return;
    }

    // If we finished loading and no user is authenticated on root, clear stale cache and let the landing page render.
    if (!isAuthenticated && !isLoading && location.pathname === '/') {
      clearStaleAuthCache();
      return;
    }

    // If on login and already authenticated, check if they have a profile
    if (isAuthenticated && location.pathname === '/login') {
      checkUserProfile();
    }
  }, [isAuthenticated, isLoading, isSigningOut, location.pathname, navigate, checkUserProfile, authCached]);


  useEffect(() => {
    const shouldHandle = shouldHandleAuthCallback({ pathname: location.pathname, hash: window.location.hash, search: window.location.search });
    console.log('🔁 AppRouter auth callback check', {
      pathname: location.pathname,
      hash: window.location.hash,
      search: window.location.search,
      shouldHandle,
    });

    if (location.pathname !== '/auth/callback' && shouldHandle) {
      navigate(
        {
          pathname: '/auth/callback',
          search: window.location.search,
          hash: window.location.hash,
        },
        { replace: true }
      );
    }
  }, [location.pathname, navigate]);

  const handleLandingGetStarted = () => {
    navigate(getLandingEntryRoute());
  };

  const catchAllPath = getFallbackRoute(location.pathname);

  const hashRoute = window.location.hash.slice(1);
  const hasHashRoute = Boolean(hashRoute && hashRoute !== '/');
  const isAuthCallback = shouldHandleAuthCallback({ pathname: location.pathname, hash: window.location.hash, search: window.location.search });
  const pendingResumeRoute = getPendingResumeRoute();

  const hasIncompleteProfileMetadata = React.useMemo(() => {
    if (!authCached && !isAuthenticated) return false;
    try {
      if (localStorage.getItem('hasCompletedOnboarding') === 'false') {
        return true;
      }
      const raw = localStorage.getItem('_profileMetadata');
      if (!raw) {
        return true;
      }
      const meta = JSON.parse(raw);
      const isValid = Boolean(meta?.userId && meta?.hasProfile !== undefined && meta?.user_type !== undefined);
      if (!isValid) {
        return true;
      }
      return !meta?.hasProfile || !meta?.user_type;
    } catch (e) {
      console.warn('AppRouter failed to parse profile metadata:', e);
      return true;
    }
  }, [authCached, isAuthenticated]);

  const isAccountSelectorHash = hashRoute === '/account-type-selector';
  const isOnboardingHashRoute = /^\/(account-type-selector(?:\/step-[12])?|edit-profile-(employee|employer))$/.test(hashRoute);
  const shouldRedirectToResumeRoute = location.pathname === '/' && isAuthenticated && hasIncompleteProfileMetadata && Boolean(pendingResumeRoute) && !isAuthCallback;
  const shouldRedirectToAccountSelector = location.pathname === '/' && isAuthenticated && hasIncompleteProfileMetadata && !pendingResumeRoute && !isAuthCallback && !isOnboardingHashRoute;
  const shouldRedirectToHome = location.pathname === '/' && isAuthenticated && !hasIncompleteProfileMetadata && !isAuthCallback;
  const shouldRedirectToHash = hasHashRoute && hashRoute !== '/landing' && !isAuthCallback && location.pathname === '/' && (!isOnboardingHashRoute || hasIncompleteProfileMetadata || shouldRedirectToResumeRoute);

  console.log('🧭 AppRouter render state', {
    pathname: location.pathname,
    hashRoute,
    hasHashRoute,
    isAccountSelectorHash,
    isAuthCallback,
    authCached,
    isAuthenticated,
    isLoading,
    isSigningOut,
    hasIncompleteProfileMetadata,
    shouldRedirectToAccountSelector,
    shouldRedirectToHome,
    shouldRedirectToHash,
  });

// Determine what to show at root
  const renderType = isAuthCallback
    ? 'authCallback'
    : shouldRedirectToHash || shouldRedirectToResumeRoute
    ? 'hashRedirect'
    : shouldRedirectToAccountSelector
    ? 'accountSelector'
    : shouldRedirectToHome
    ? 'home'
    : 'landing';

  const effectiveResumeRoute = pendingResumeRoute || hashRoute;

  const rootElement = renderType === 'authCallback' ? (
    <Navigate to="/auth/callback" replace />
  ) : renderType === 'hashRedirect' ? (
    <Navigate to={effectiveResumeRoute || '/account-type-selector'} replace />
  ) : renderType === 'accountSelector' ? (
    <Navigate to={pendingResumeRoute || '/account-type-selector'} replace />
  ) : renderType === 'home' ? (
    <Navigate to="/home" replace />
  ) : (
    <Landing onGetStarted={handleLandingGetStarted} />
  );

  console.log('🧭 AppRouter result', {
    renderType,
    isLoading,
    isAuthenticated,
    isAuthCallback,
    shouldRedirectToHash,
  });

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={rootElement} />
      <Route path="/login" element={<Login />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* Protected Routes */}
      <Route
        path="/account-type-selector"
        element={
          <ProtectedRoute>
            <JobLink initialView="account-selector" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/account-type-selector/*"
        element={
          <ProtectedRoute>
            <JobLink initialView="account-selector" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/edit-profile-employee"
        element={
          <ProtectedRoute>
            <JobLink initialView="edit-profile-employee" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/edit-profile-employee/*"
        element={
          <ProtectedRoute>
            <JobLink initialView="edit-profile-employee" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/edit-profile-employer"
        element={
          <ProtectedRoute>
            <JobLink initialView="edit-profile-employer" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/edit-profile-employer/*"
        element={
          <ProtectedRoute>
            <JobLink initialView="edit-profile-employer" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/media-debug"
        element={
          <ProtectedRoute>
            <MediaDebugPanel />
          </ProtectedRoute>
        }
      />
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <JobLink />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile/:profileId/:type"
        element={
          <ProtectedRoute>
            <FollowLikeListPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={catchAllPath} replace />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <JobLink />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

/**
 * Minimal full-screen fallback that visually matches the native splash to avoid
 * a blank gap while lazy-loaded chunks arrive. It respects the user's
 * prefers-color-scheme so dark-mode behavior remains consistent.
 */
// SplashFallback was removed per user request; previous lazy-loading was reverted.

// Removed lazy-loading and SplashFallback per user request

/**
 * Lightweight global overlay shown during OAuth transitions
 * Appears instantly when `_oauthInProgress` is set or `oauthStarted` event fires
 */

/**
 * Main App Wrapper Component
 * Provides authentication context and routing
 */
export default function AppWrapper() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const [authCached] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('_authCached') === 'true';
  });
  const nativeOauthPickerActiveRef = React.useRef(false);

  React.useEffect(() => {
    return initViewportHeight();
  }, []);

  // On app startup, clear stale oauth/auth flags if there's no active session
  React.useEffect(() => {
    let isActive = true;
    (async () => {
      try {
        const oauthInProgress = localStorage.getItem('_oauthInProgress') === 'true';
        const authCached = localStorage.getItem('_authCached') === 'true';
        const { data: { session } } = await supabase.auth.getSession();
        if (!isActive) return;

        const isCallbackRoute = window.location.pathname === '/auth/callback';
        const callbackParamsPresent = shouldHandleAuthCallback({ pathname: window.location.pathname, hash: window.location.hash, search: window.location.search });

        console.log('🔎 AppWrapper startup auth check', {
          hasSession: Boolean(session),
          oauthInProgress,
          authCached,
          sessionUser: session?.user?.email || session?.user?.id || null,
          currentPath: window.location.pathname,
          isCallbackRoute,
          callbackParamsPresent,
        });

        const shouldClear = !isCallbackRoute && !callbackParamsPresent && shouldClearStaleAuthFlags({ hasSession: Boolean(session), oauthInProgress, authCached });

        if (shouldClear) {
          try { localStorage.removeItem('_oauthInProgress'); } catch (e) {}
          try { localStorage.removeItem('_authCached'); } catch (e) {}
          console.log('ℹ️ Cleared stale oauth/auth flags on startup');
        } else if (isCallbackRoute && !oauthInProgress && !authCached && !session) {
          try { localStorage.removeItem('_oauthInProgress'); } catch (e) {}
          console.log('ℹ️ Cleared stale callback state on empty callback route');
        } else {
          console.log('ℹ️ No stale auth flags to clear on startup');
        }
      } catch (err) {
        console.warn('Error checking session on startup:', err);
      }
    })();

    return () => { isActive = false; };
  }, []);

  // Handle native deep links early so we don't flash /login before processing callback
  React.useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleAppUrlOpen = async (event) => {
      try {
        const slug = event.url.replace(/.*?:\/\//g, '');
        console.log('🔗 AppWrapper deep link:', slug);

        if (slug.startsWith('auth/callback')) {
          // Mark OAuth as in progress while we process the deep link
          try { localStorage.setItem('_oauthInProgress', 'true'); } catch (e) {}

          // Extract hash (tokens are after #)
          const hashPart = slug.split('#')[1];
          if (!hashPart) {
            console.warn('⚠️ No hash in deep link');
            return;
          }

          const params = new URLSearchParams(hashPart);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken && refreshToken) {
            console.log('🔑 Setting session from deep link in AppWrapper');
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) {
              console.error('❌ Error setting session from deep link:', error);
              localStorage.removeItem('_oauthInProgress');
              return;
            }

            // Mark auth cached and clear oauth flag so router won't redirect to /login
            localStorage.setItem('_authCached', 'true');
            localStorage.removeItem('_oauthInProgress');
            window.dispatchEvent(new CustomEvent('oauthCompleted'));
            console.log('✅ Deep link session set and auth flags updated');
          }
        } else if (slug.startsWith('app/')) {
          const appPath = '/' + slug.slice('app/'.length);
          console.log('📱 Shortcut deep link to route:', appPath);
          navigate(appPath);
        }
      } catch (err) {
        console.error('❌ AppWrapper deep link handler error:', err);
      }
    };

    const listener = CapacitorApp.addListener('appUrlOpen', handleAppUrlOpen);

    return () => {
      try {
        listener.remove();
      } catch (e) {
        /* ignore */
      }
    };
  }, [navigate]);

  // Ensure we keep the oauth-in-progress overlay visible when the app goes to background
  // (e.g., user opened the native browser for OAuth). If the app returns and no session
  // exists, cancel the native sign-in flow so the user can safely return to login.
  React.useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const cancelOAuth = async () => {
      try {
        nativeOauthPickerActiveRef.current = false;

        try {
          const plugin = window.plugins?.googleplus;
          if (plugin?.disconnect) {
            plugin.disconnect(() => {}, () => {});
          } else if (plugin?.logout) {
            plugin.logout(() => {}, () => {});
          }
        } catch (e) {
          console.warn('Google picker disconnect skipped:', e);
        }

        localStorage.removeItem('_oauthInProgress');
        try { window.dispatchEvent(new CustomEvent('oauthCancelled', { detail: { cancelled: true } })); } catch (e) {}
        try { window.dispatchEvent(new CustomEvent('oauthCompleted', { detail: { cancelled: true } })); } catch (e) {}
        console.log('🔙 Native OAuth flow cancelled after returning without session');
      } catch (e) {
        console.warn('Error cancelling OAuth flow', e);
      }
    };

    const handleAppState = async (state) => {
      try {
        const oauthFlag = localStorage.getItem('_oauthInProgress') === 'true';
        if (!oauthFlag) return;

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setTimeout(() => {
            if (localStorage.getItem('_oauthInProgress') === 'true' && !nativeOauthPickerActiveRef.current) {
              cancelOAuth();
            }
          }, 120);
        }
      } catch (e) {
        console.warn('Error handling appState change', e);
      }
    };

    const handleWindowFocus = () => {
      if (localStorage.getItem('_oauthInProgress') !== 'true' || nativeOauthPickerActiveRef.current) return;
      setTimeout(() => {
        if (localStorage.getItem('_oauthInProgress') === 'true' && !nativeOauthPickerActiveRef.current) {
          cancelOAuth();
        }
      }, 180);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && localStorage.getItem('_oauthInProgress') === 'true' && !nativeOauthPickerActiveRef.current) {
        setTimeout(() => {
          if (localStorage.getItem('_oauthInProgress') === 'true' && !nativeOauthPickerActiveRef.current) {
            cancelOAuth();
          }
        }, 180);
      }
    };

    const sub = CapacitorApp.addListener('appStateChange', handleAppState);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      try { sub.remove(); } catch (e) {}
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Allow Android back button to cancel a native OAuth flow.
  React.useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let backListener = null;

    const handleBackButton = async () => {
      try {
        const oauthFlag = localStorage.getItem('_oauthInProgress') === 'true';
        if (!oauthFlag || nativeOauthPickerActiveRef.current) return;

        localStorage.removeItem('_oauthInProgress');
        console.log('⌛ Native back button cancelled OAuth flow');
      } catch (e) {
        console.warn('Error handling Android back button during OAuth flow', e);
      }
    };

    const setupListener = async () => {
      try {
        backListener = await CapacitorApp.addListener('backButton', handleBackButton);
      } catch (e) {
        console.warn('Back button listener not available:', e);
      }
    };

    setupListener();

    return () => {
      try {
        if (backListener?.remove) {
          backListener.remove();
        }
      } catch (e) {
        console.warn('Failed to remove back button listener:', e);
      }
    };
  }, []);

  // Enforce per-user screenshot preference on auth change
  useEffect(() => {
    const applyScreenshotPreference = async () => {
      try {
        if (!Capacitor.isNativePlatform()) return;
        // useAuth is not available directly here, so read from localStorage or fetch profile
        // Prefer fetching up-to-date profile from Supabase via window event
        const storedAuth = localStorage.getItem('_authCached') === 'true';
        if (!storedAuth) return;

        // Try to call server to get profile: dispatch event to let AuthContext handle and attach profile
        // Fallback: call a global function `window.getCurrentUserProfile` if present
        let profile = null;
        if (window.getCurrentUserProfile) {
          profile = await window.getCurrentUserProfile();
        }

        // If no profile available, default to blocking screenshots
        const allowScreenshots = profile?.allow_screenshots === true;

        // Plugin expects `secure: true` to block screenshots
        await setSecure(!allowScreenshots);
      } catch (e) {
        console.warn('Failed to apply screenshot preference:', e);
      }
    };

    applyScreenshotPreference();
  }, []);

  return (
    <AuthProvider>
      <NotificationProvider>
        <DeferredMount>
          <ToastContainer />
          <RealtimeListener />
        </DeferredMount>
        <AppRouter />
      </NotificationProvider>
    </AuthProvider>
  );
}

/**
 * Mount children after first paint to avoid blocking initial render and
 * reduce perceived startup time. Uses requestAnimationFrame -> setTimeout(0)
 * to schedule after first paint.
 */
function DeferredMount({ children }) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    let raf = null;
    const onFrame = () => {
      // schedule microtask after paint
      setTimeout(() => setMounted(true), 0);
    };
    if (typeof window !== 'undefined') {
      raf = window.requestAnimationFrame(onFrame);
    } else {
      setMounted(true);
    }
    return () => {
      if (raf && window.cancelAnimationFrame) window.cancelAnimationFrame(raf);
    };
  }, []);

  return mounted ? children : <StartupLoadingFallback />;
}
