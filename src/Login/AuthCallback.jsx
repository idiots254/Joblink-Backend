import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

const normalizePendingRoute = (route) => {
  if (typeof route !== 'string') return '';
  let normalized = route.trim();
  if (normalized.startsWith('#')) {
    normalized = normalized.slice(1);
  }
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  normalized = normalized.replace(/\s+$/g, '').replace(/\/+$|\/\s+$|\s+$/g, '');
  return normalized;
};

const getPendingResumeRoute = () => {
  if (typeof window === 'undefined') return null;
  try {
    const savedLastRoute = localStorage.getItem('joblinkLastRoute');
    const draftRaw = localStorage.getItem('joblinkPendingProfileDraft');
    const draft = draftRaw ? JSON.parse(draftRaw) : null;
    const routeFromDraft = draft?.accountType ? `/edit-profile-${draft.accountType}` : null;
    const saved = normalizePendingRoute(savedLastRoute);
    const route = routeFromDraft || saved;
    if (!route || route === '/landing' || route === '/login' || route === '/auth/callback') {
      return null;
    }
    const isOnboardingRoute = /^\/edit-profile-(employee|employer)$/.test(route) || /^\/account-type-selector(?:\/step-[12])?$/.test(route);
    return isOnboardingRoute ? route : null;
  } catch (e) {
    console.warn('AuthCallback failed to read pending resume route:', e);
    return null;
  }
};

/**
 * Auth Callback Component
 * Processes OAuth callback and redirects based on whether the user has a profile.
 */
export default function AuthCallback() {
  const navigate = useNavigate();

  const [processing, setProcessing] = React.useState(true);

  const fireOauthCompleted = (cancelled = false) => {
    try {
      window.dispatchEvent(new CustomEvent('oauthCompleted', { detail: { cancelled, immediate: true } }));
    } catch (e) {
      console.warn('⚠️ AuthCallback failed to dispatch oauthCompleted:', e);
    }

    setTimeout(() => {
      try {
        window.dispatchEvent(new CustomEvent('oauthCompleted', { detail: { cancelled, immediate: true } }));
      } catch (e) {
        // ignore duplicate dispatch failures
      }
    }, 50);
  };

  useEffect(() => {
    console.log('🔵 [AuthCallback] Component mounted, starting OAuth callback handler');

    const getPreferredRedirect = () => {
      try {
        const completed = localStorage.getItem('hasCompletedOnboarding') === 'true';
        if (completed) return '/home';

        const profileMetadata = localStorage.getItem('_profileMetadata');
        if (profileMetadata) {
          const parsed = JSON.parse(profileMetadata);
          if (parsed?.hasProfile && parsed?.user_type) {
            return '/home';
          }
        }
      } catch (e) {
        console.warn('⚠️ AuthCallback failed to parse profile metadata for redirect:', e);
      }
      return '/account-type-selector';
    };

    const handleCallback = async () => {
      console.log('🔵 [AuthCallback] handleCallback started');

      try {
        localStorage.setItem('_oauthInProgress', 'true');
        window.dispatchEvent(new CustomEvent('oauthStarted', { detail: { immediate: true } }));

        const rawParams = window.location.hash.startsWith('#')
          ? window.location.hash.slice(1)
          : window.location.search.replace(/^[?]/, '');
        const urlParams = new URLSearchParams(rawParams);
        const hasAuthParams = urlParams.has('access_token') || urlParams.has('refresh_token') || urlParams.has('code') || urlParams.has('error_description') || urlParams.has('error');

        const getSession = async () => {
          const {
            data: { session },
            error: sessionError,
          } = await supabase.auth.getSession();

          if (sessionError) {
            console.error('❌ AuthCallback session error:', sessionError);
          }

          return session;
        };

        const getSessionFromUrl = async () => {
          if (typeof supabase.auth.getSessionFromUrl !== 'function') {
            return null;
          }

          try {
            const {
              data: { session },
              error,
            } = await supabase.auth.getSessionFromUrl({ storeSession: true });

            if (error) {
              console.warn('⚠️ AuthCallback getSessionFromUrl error:', error);
            }

            return session;
          } catch (err) {
            console.error('❌ AuthCallback getSessionFromUrl exception:', err);
            return null;
          }
        };

        const waitForSession = async (attempts = 5, initialDelay = 50) => {
          let session = await getSession();
          let delay = initialDelay;
          for (let attempt = 0; attempt < attempts && !session; attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, delay));
            session = await getSession();
            delay *= 2;
          }
          return session;
        };

        let session = await waitForSession(3, 50);

        if (hasAuthParams) {
          console.log('ℹ️ AuthCallback: auth params detected, attempting URL session restore');
          if (!session) {
            session = await getSessionFromUrl();
          }

          if (!session && (urlParams.get('access_token') || urlParams.get('refresh_token')) && (urlParams.get('access_token') && urlParams.get('refresh_token'))) {
            console.log('🔄 AuthCallback attempting fast session restore from URL tokens');
            const { error: setSessionError } = await supabase.auth.setSession({
              access_token: urlParams.get('access_token'),
              refresh_token: urlParams.get('refresh_token'),
            });
            if (setSessionError) {
              console.warn('⚠️ AuthCallback fallback setSession error:', setSessionError);
            }
            session = await waitForSession(4, 50);
          }

          if (!session) {
            console.log('🔄 AuthCallback session not immediately visible; checking once more');
            session = await waitForSession(4, 100);
          }
        } else {
          console.log('ℹ️ AuthCallback: no auth params found in callback URL, checking for an existing session');
          if (!session) {
            session = await waitForSession(4, 100);
          }
        }

        if (session) {
          if (window.location.pathname !== '/auth/callback' || window.location.hash || window.location.search) {
            window.history.replaceState(null, '', '/auth/callback');
          }
          localStorage.setItem('_authCached', 'true');
          try {
            const metadata = session.user.user_metadata || {};
            const identityData = session.user.identities?.[0]?.identity_data || {};
            const avatarUrl =
              metadata.avatar_url ||
              metadata.picture ||
              identityData.avatar_url ||
              identityData.picture ||
              null;

            const displayName =
              metadata.displayName ||
              metadata.name ||
              identityData.name ||
              session.user.email.split('@')[0];

            localStorage.setItem(
              'joblinkUser',
              JSON.stringify({
                id: session.user.id,
                email: session.user.email,
                displayName,
                avatar: avatarUrl,
              })
            );

            if (avatarUrl) {
              localStorage.setItem('userAvatar', avatarUrl);
              localStorage.setItem('employerAvatar', avatarUrl);
            }
          } catch (e) {
            console.warn('⚠️ Failed to cache joblinkUser:', e);
          }

          try {
            const { data: profile, error } = await supabase
              .from('profiles')
              .select('id, user_type')
              .eq('id', session.user.id)
              .maybeSingle();

            console.log('🔵 [AuthCallback] Profile query result - profile:', profile, 'error code:', error?.code);

            if (profile?.id && profile?.user_type) {
              console.log('✅ [AuthCallback] Profile complete for this user; redirecting to home');
              localStorage.setItem('hasCompletedOnboarding', 'true');
              navigate('/home', { replace: true });
            } else {
              const pendingResumeRoute = getPendingResumeRoute();
              console.log('✅ [AuthCallback] Profile incomplete or missing; redirecting to onboarding or resume route', {
                pendingResumeRoute,
                profile,
                error,
              });
              localStorage.setItem('hasCompletedOnboarding', 'false');
              navigate(pendingResumeRoute || '/account-type-selector', { replace: true });
            }

            localStorage.removeItem('_oauthInProgress');
            fireOauthCompleted();
            setProcessing(false);
          } catch (profileError) {
            console.error('❌ [AuthCallback] Unexpected error checking profile:', profileError);
            localStorage.removeItem('_oauthInProgress');
            fireOauthCompleted();
            setProcessing(false);
            navigate('/account-type-selector', { replace: true });
          }
          return;
        }

        console.warn('⚠️ AuthCallback did not find a valid session after redirect');
        navigate('/login', { replace: true });
        localStorage.removeItem('_oauthInProgress');
        fireOauthCompleted();
        setProcessing(false);
      } catch (err) {
        console.error('❌ AuthCallback error:', err);
        navigate('/login', { replace: true });
        localStorage.removeItem('_oauthInProgress');
        fireOauthCompleted();
        setProcessing(false);
      }
    };

    handleCallback();
  }, [navigate]);

  if (processing) {
    return null;
  }

  return null;
}
