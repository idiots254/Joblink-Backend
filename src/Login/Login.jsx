import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';
import { FcGoogle } from 'react-icons/fc';
import { Capacitor } from '@capacitor/core';
import { API_URL } from '../config';
import { getGoogleSignInErrorMessage } from './googleAuth';
import { getPublicAssetUrl } from '../utils/publicAssetUrl';

// Simple timestamped debug logger for this file
const dbg = (...args) => console.log('[Login Debug]', new Date().toISOString(), ...args);

/**
 * Login Page Component
 * Handles Google SSO authentication via Supabase
 */
export default function Login() {
  const { isAuthenticated, isLoading: authLoading, signInWithOAuth } = useAuth();
  const [hasRedirected, setHasRedirected] = useState(false);
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [oauthInProgress, setOauthInProgress] = useState(() => localStorage.getItem('_oauthInProgress') === 'true');
  const [isExiting, setIsExiting] = useState(false);
  const isLoginInProgressRef = useRef(false);
  const nativeOauthActiveRef = useRef(false);
  const pendingOauthCleanupRef = useRef(null);

  const setNativeOauthActive = useCallback((active) => {
    nativeOauthActiveRef.current = active;
    try {
      window.dispatchEvent(new CustomEvent('oauthNativePickerActive', { detail: { active } }));
    } catch (e) {
      console.warn('Failed to dispatch oauthNativePickerActive event', e);
    }
  }, []);

  const cancelNativeGooglePicker = useCallback(() => {
    setNativeOauthActive(false);
    try {
      const plugin = window.plugins?.googleplus;
      if (plugin?.disconnect) {
        plugin.disconnect(() => {}, () => {});
      } else if (plugin?.logout) {
        plugin.logout(() => {}, () => {});
      }
    } catch (e) {
      console.warn('Native Google picker cancel skipped:', e);
    }
  }, [setNativeOauthActive]);

  const clearPendingOauthCleanup = useCallback(() => {
    if (pendingOauthCleanupRef.current) {
      clearTimeout(pendingOauthCleanupRef.current);
      pendingOauthCleanupRef.current = null;
    }
  }, []);

  const clearOauthState = useCallback((cancelled = false) => {
    clearPendingOauthCleanup();
    setOauthInProgress(false);
    setNativeOauthActive(false);
    localStorage.removeItem('_oauthInProgress');
    if (cancelled) {
      try { localStorage.removeItem('_authCached'); } catch (e) {}
      setError('');
    }
  }, [clearPendingOauthCleanup, setNativeOauthActive]);

  const forceExitOauthOverlay = useCallback(() => {
    clearPendingOauthCleanup();
    clearOauthState(true);
    setIsLoading(false);
    setShouldRedirect(false);
    setHasRedirected(false);
  }, [clearOauthState, clearPendingOauthCleanup]);

  const softExitOauthOverlay = useCallback(() => {
    clearPendingOauthCleanup();
    pendingOauthCleanupRef.current = window.setTimeout(() => {
      pendingOauthCleanupRef.current = null;
      forceExitOauthOverlay();
    }, 60);
  }, [clearPendingOauthCleanup, forceExitOauthOverlay]);

  const recoverFromOauthFlow = useCallback(async () => {
    if (localStorage.getItem('_oauthInProgress') !== 'true') return;

    clearPendingOauthCleanup();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      cancelNativeGooglePicker();
      forceExitOauthOverlay();
      try { window.dispatchEvent(new CustomEvent('oauthCancelled', { detail: { cancelled: true } })); } catch (e) {}
    }
  }, [cancelNativeGooglePicker, clearPendingOauthCleanup, forceExitOauthOverlay]);

  const oauthFlagActive = typeof window !== 'undefined' && localStorage.getItem('_oauthInProgress') === 'true';
  const showAuthLoading = Boolean(oauthInProgress || oauthFlagActive);

  const getPendingResumeRoute = useCallback(() => {
    try {
      const draftRaw = localStorage.getItem('joblinkPendingProfileDraft');
      const draft = draftRaw ? JSON.parse(draftRaw) : null;
      return draft?.accountType ? `/edit-profile-${draft.accountType}` : null;
    } catch (e) {
      console.warn('[Login] Failed to parse pending profile draft:', e);
      return null;
    }
  }, []);

  const getLoginRedirectPath = useCallback(() => {
    try {
      if (localStorage.getItem('hasCompletedOnboarding') === 'true') {
        return '/';
      }
    } catch (e) {
      console.warn('[Login] Failed to read onboarding flag:', e);
    }

    try {
      const rawProfileMetadata = localStorage.getItem('_profileMetadata');
      if (rawProfileMetadata) {
        const profileMetadata = JSON.parse(rawProfileMetadata);
        if (profileMetadata?.hasProfile && profileMetadata?.user_type) {
          return '/';
        }
      }
    } catch (e) {
      console.warn('[Login] Failed to parse profile metadata:', e);
    }

    const pendingResumeRoute = getPendingResumeRoute();
    if (pendingResumeRoute) {
      return pendingResumeRoute;
    }

    try {
      if (localStorage.getItem('hasCompletedOnboarding') === 'false') {
        return '/account-type-selector';
      }
    } catch (e) {
      console.warn('[Login] Failed to read onboarding flag:', e);
    }

    try {
      const rawProfileMetadata = localStorage.getItem('_profileMetadata');
      if (rawProfileMetadata) {
        const profileMetadata = JSON.parse(rawProfileMetadata);
        if (!profileMetadata?.hasProfile || !profileMetadata?.user_type) {
          return '/account-type-selector';
        }
      }
    } catch (e) {
      console.warn('[Login] Failed to parse profile metadata:', e);
    }

    return '/';
  }, [getPendingResumeRoute]);

  // Redirect away from login if already authenticated.
  useEffect(() => {
    if (!authLoading && isAuthenticated && !hasRedirected) {
      setHasRedirected(true);
      setShouldRedirect(true);
    }
  }, [authLoading, isAuthenticated, hasRedirected]);

  // Clear stale OAuth state when we land on the login page without an active auth session.
  useEffect(() => {
    const rawParams = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.search.replace(/^[?]/, '');
    const urlParams = new URLSearchParams(rawParams);
    const hasAuthParams = urlParams.has('access_token') || urlParams.has('refresh_token') || urlParams.has('code') || urlParams.has('error_description') || urlParams.has('error');

    if (
      window.location.pathname === '/login' &&
      oauthFlagActive &&
      !authLoading &&
      !isAuthenticated &&
      !hasAuthParams
    ) {
      console.log('🔄 Clearing stale OAuth state on login page', {
        oauthFlagActive,
        authLoading,
        isAuthenticated,
        pathname: window.location.pathname,
        hasAuthParams,
      });
      clearOauthState(true);
    }

    if (
      window.location.pathname === '/login' &&
      oauthFlagActive &&
      !authLoading &&
      !isAuthenticated &&
      hasAuthParams
    ) {
      console.log('ℹ️ Login page has callback params, preserving OAuth state while callback resolves');
      return;
    }
  }, [oauthFlagActive, authLoading, isAuthenticated, clearOauthState]);

  // Fade out and then redirect smoothly (desktop only; mobile has instant transitions)
  useEffect(() => {
    if (shouldRedirect && !isExiting) {
      setIsExiting(true);
      // On native mobile, redirect immediately; on web, wait for fade transition
      const isNative = Capacitor.isNativePlatform();
      const delay = isNative ? 0 : 350;
      const timer = setTimeout(() => {
        setShouldRedirect(false);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [shouldRedirect, isExiting]);

  // Memoize event handlers so the effect can depend on stable references
  const handleOauthStarted = useCallback(() => {
    clearPendingOauthCleanup();
    setOauthInProgress(true);
    localStorage.setItem('_oauthInProgress', 'true');
  }, [clearPendingOauthCleanup, setOauthInProgress]);

  const handleOauthCompleted = useCallback(async (event) => {
    if (event?.detail?.cancelled) {
      clearOauthState(true);
      return;
    }

    clearOauthState();
    // AuthContext will detect the new session and trigger the redirect effect above
  }, [clearOauthState]);

  const handleOauthCancelled = useCallback(() => {
    clearPendingOauthCleanup();
    setNativeOauthActive(false);
    forceExitOauthOverlay();
    // Don't re-dispatch oauthCancelled from within the oauthCancelled handler.
    // That caused a recursive event loop and stack overflow.
  }, [clearPendingOauthCleanup, setNativeOauthActive, forceExitOauthOverlay]);

  const handleWindowFocus = useCallback(() => {
    if (nativeOauthActiveRef.current) return;
    setTimeout(() => {
      if (!nativeOauthActiveRef.current) {
        recoverFromOauthFlow();
      }
    }, 80);
  }, [recoverFromOauthFlow]);

  // Track OAuth start/completion so we can hide login UI immediately.
  useEffect(() => {
    window.addEventListener('oauthStarted', handleOauthStarted);
    window.addEventListener('oauthCompleted', handleOauthCompleted);
    window.addEventListener('oauthCancelled', handleOauthCancelled);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleWindowFocus);

    return () => {
      window.removeEventListener('oauthStarted', handleOauthStarted);
      window.removeEventListener('oauthCompleted', handleOauthCompleted);
      window.removeEventListener('oauthCancelled', handleOauthCancelled);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleWindowFocus);
    };
  }, [handleOauthStarted, handleOauthCompleted, handleOauthCancelled, handleWindowFocus]);

  // Web OAuth handler redirects to /auth/callback for token processing
  // Avoid redirecting from /login on stale `_oauthInProgress` state.
  if (showAuthLoading && !Capacitor.isNativePlatform() && window.location.pathname !== '/login') {
    return <Navigate to="/auth/callback" replace />;
  }

  // Single redirect point: when auth succeeds, fade out then leave the page
  if ((isAuthenticated || shouldRedirect) && !authLoading && isExiting) {
    return <Navigate to={getLoginRedirectPath()} replace />;
  }

  /**
   * Handle Google Sign In - Native in-app picker on mobile, OAuth on web
   */
  const handleGoogleSignIn = async () => {
    const oauthFlag = '_oauthInProgress';

    try {
      isLoginInProgressRef.current = true;
      setError('');

      const isNative = Capacitor.isNativePlatform();
      console.log('🔐 Google Sign In - Platform:', isNative ? 'Mobile' : 'Web');

      if (isNative) {
          clearPendingOauthCleanup();
          setOauthInProgress(true);
          setIsLoading(true);
          localStorage.setItem(oauthFlag, 'true');
          try { window.dispatchEvent(new CustomEvent('oauthStarted', { detail: { immediate: true } })); } catch (e) {}

          const pluginAvailable = !!window.plugins?.googleplus;
          dbg('Native flow: pluginAvailable =', pluginAvailable, 'window.plugins.googleplus exists =', !!window.plugins?.googleplus);
          
          if (pluginAvailable) {
            console.log('📱 Starting native Google Sign-In (in-app account picker)...');
            setNativeOauthActive(true);
            setError('');
            // Log environment and client IDs for debugging
            const webClientId = process.env.REACT_APP_GOOGLE_WEB_CLIENT_ID;
            dbg('Calling googleplus.login with webClientId:', webClientId);
            dbg('Process env keys present:', Object.keys(process.env).filter(k => k.includes('GOOGLE') || k.includes('BACKEND')));
            if (!webClientId) {
              console.warn('⚠️ REACT_APP_GOOGLE_WEB_CLIENT_ID is not set. Native Google Sign-In requires a valid web OAuth client ID.');
            }

            // Call native Google Sign-In plugin
            window.plugins.googleplus.login(
            {
              scopes: 'profile email',
              webClientId: process.env.REACT_APP_GOOGLE_WEB_CLIENT_ID || '1053677464000-2sbmgpffk5qjtmpmtkj093uhkvrfnbsn.apps.googleusercontent.com',
              offline: true,
            },
            async (result) => {
              dbg('googleplus.login success callback invoked');
              dbg('raw result object:', result);
              try {
                console.log('✅ Native Google Sign-In result:', {
                  email: result.email,
                  displayName: result.displayName,
                  hasIdToken: !!result.idToken,
                  hasAccessToken: !!result.accessToken
                });

                // Exchange Google token via backend endpoint
                if (result.idToken) {
                  console.log('🔑 Exchanging Google ID token with backend...');
                  
                  const backendUrl = API_URL || (Capacitor.isNativePlatform() ? 'http://192.168.100.5:8080' : 'http://localhost:8080');
                  console.log('🌐 Using backend URL:', backendUrl);
                  dbg('Preparing backend exchange', { backendUrl, tokenPresent: !!result.idToken, email: result.email });
                  console.log('🌐 API call to:', `${backendUrl}/api/auth/google-signin`);

                  const requestBody = {
                    token: result.idToken,
                    email: result.email,
                    name: result.displayName,
                  };

                  dbg('Backend request body (masked token):', { email: requestBody.email, name: requestBody.name, tokenPreview: requestBody.token?.slice(0,20) });

                  const response = await fetch(`${backendUrl}/api/auth/google-signin`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody),
                  });

                  dbg('Backend response status:', response.status);

                  if (!response.ok) {
                    let errorData;
                    try {
                      errorData = await response.json();
                    } catch (e) {
                      errorData = { message: `HTTP ${response.status}` };
                    }
                    dbg('Backend returned non-OK, response body:', errorData);
                    console.error('❌ Backend error:', errorData);
                    throw new Error(errorData.message || `Failed to exchange token (${response.status})`);
                  }

                  const data = await response.json();
                  console.log('✅ Backend returned session:', {
                    hasAccessToken: !!data.session?.access_token,
                    hasRefreshToken: !!data.session?.refresh_token,
                  });

                  // Set Supabase session with tokens from backend
                  if (data.session?.access_token && data.session?.refresh_token) {
                    console.log('🔑 Setting Supabase session...');
                    const { error } = await supabase.auth.setSession({
                      access_token: data.session.access_token,
                      refresh_token: data.session.refresh_token,
                    });

                    if (error) {
                      console.error('❌ Error setting session:', error);
                      setError('Failed to establish session');
                      localStorage.removeItem(oauthFlag);
                      setIsLoading(false);
                      setNativeOauthActive(false);
                      return;
                    }

                    console.log('✅ Session established successfully!');

                    localStorage.setItem('_authCached', 'true');
                    localStorage.removeItem(oauthFlag);
                    
                    // Cache the profile metadata from backend to prevent redundant lookups during routing
                    try {
                      const profileMetadata = {
                        hasProfile: Boolean(data?.hasProfile),
                        user_type: data?.user_type || null,
                        userId: data?.user?.id,
                      };
                      localStorage.setItem('_profileMetadata', JSON.stringify(profileMetadata));
                      if (data?.hasProfile && data?.user_type) {
                        localStorage.setItem('hasCompletedOnboarding', 'true');
                      } else {
                        localStorage.setItem('hasCompletedOnboarding', 'false');
                      }
                    } catch (e) {}

                    console.log('✅ [NativeOAuth] Session and profile cached, redirect will be handled by auth effect');

                    try {
                      window.dispatchEvent(new CustomEvent('oauthCompleted', { detail: { immediate: true } }));
                    } catch (navErr) {
                      console.warn('⚠️ oauthCompleted dispatch failed:', navErr);
                    }
                    setNativeOauthActive(false);
                  } else {
                    console.warn('⚠️ No session tokens in response');
                    setOauthInProgress(false);
                    localStorage.removeItem(oauthFlag);
                    setIsLoading(false);
                    setNativeOauthActive(false);
                  }
                } else {
                  console.warn('⚠️ No ID token from Google Sign-In');
                  setOauthInProgress(false);
                  localStorage.removeItem(oauthFlag);
                  setIsLoading(false);
                  setNativeOauthActive(false);
                }
              } catch (err) {
                console.error('❌ Native sign-in exchange error:', err);
                setOauthInProgress(false);
                localStorage.removeItem(oauthFlag);
                setIsLoading(false);
                setNativeOauthActive(false);
              }
            },
            async (error) => {
              setNativeOauthActive(false);
              dbg('googleplus.login error callback invoked, typeof error:', typeof error);
              try { dbg('googleplus.login error object:', JSON.stringify(error)); } catch (e) { dbg('error stringify failed', error); }

              const errorMsg = getGoogleSignInErrorMessage(error);
              dbg('Mapped error code', error, 'to message:', errorMsg);

              const fallbackErrors = [
                'Plugin configuration issue or operation cancelled',
                'Native Google Sign-In unavailable or misconfigured',
                'API not available on this device',
              ];

              const userFacingError = fallbackErrors.includes(errorMsg)
                ? 'Google Sign-In failed due to native plugin configuration or availability. Redirecting to web login instead.'
                : errorMsg;

              setError(userFacingError);

              if (errorMsg === 'Sign-in was cancelled') {
                console.log('ℹ️ Native Google Sign-In cancelled by user; clearing auth flow state.');
                softExitOauthOverlay();
                try { window.dispatchEvent(new CustomEvent('oauthCancelled', { detail: { cancelled: true } })); } catch (e) {}
                return;
              }

              if (fallbackErrors.includes(errorMsg)) {
                console.warn('⚠️ Native Google Sign-In failed with native plugin error:', errorMsg);
                softExitOauthOverlay();
                localStorage.removeItem(oauthFlag);
                setOauthInProgress(false);
                setIsLoading(false);
                setNativeOauthActive(false);
                try { window.dispatchEvent(new CustomEvent('oauthCancelled', { detail: { cancelled: true } })); } catch (e) {}
                return;
              }

              console.error('❌ Native Google Sign-In error:', error);
              console.warn('⚠️ Error message:', errorMsg);

              softExitOauthOverlay();
              try { window.dispatchEvent(new CustomEvent('oauthCancelled', { detail: { cancelled: true } })); } catch (e) {}
            }
          );
          return;
        } else {
          console.error('❌ Native Google Sign-In plugin not available on this device.');
          setError('Google Sign-In plugin unavailable. Please install the native app or verify the plugin installation.');
          localStorage.removeItem(oauthFlag);
          setOauthInProgress(false);
          setIsLoading(false);
          return;
        }
      }

      if (!isNative) {
        clearPendingOauthCleanup();
        setError('');
        setOauthInProgress(true);
        setIsLoading(true);
        localStorage.setItem(oauthFlag, 'true');
        try { window.dispatchEvent(new CustomEvent('oauthStarted', { detail: { immediate: true } })); } catch (e) {}

        try {
          await signInWithOAuth('google');
          return;
        } catch (err) {
          console.error('❌ Web OAuth sign-in error:', err);
          setError('Google Sign-In failed. Please try again.');
          localStorage.removeItem(oauthFlag);
          setOauthInProgress(false);
          setIsLoading(false);
          return;
        }
      }

      if (!window.plugins?.googleplus) {
        clearPendingOauthCleanup();
        console.error('❌ Native Google Sign-In plugin not available on this device.');
        setError('Google Sign-In plugin unavailable. Please install the native app or verify the plugin installation.');
        localStorage.removeItem(oauthFlag);
        setOauthInProgress(false);
        setIsLoading(false);
        return;
      }
    } catch (err) {
      console.error('❌ Sign in error:', err);
      localStorage.removeItem('_oauthInProgress');
      setOauthInProgress(false);
      setIsLoading(false);
      throw err;
    } finally {
      isLoginInProgressRef.current = false;
    }
  };

  /**
   * Handle Email/Password Sign Up
   */
  const handleEmailSignUp = async (e) => {
    e.preventDefault();
    isLoginInProgressRef.current = true;
    setIsLoading(true);
    setError('');

    try {
      if (!email || !password) {
        setError('Email and password are required');
        isLoginInProgressRef.current = false;
        setIsLoading(false);
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail.endsWith('@gmail.com')) {
        setError('Only Gmail addresses are allowed for registration.');
        isLoginInProgressRef.current = false;
        setIsLoading(false);
        return;
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        isLoginInProgressRef.current = false;
        setIsLoading(false);
        return;
      }

      const { error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            displayName: normalizedEmail.split('@')[0],
          },
        },
      });

      if (signUpError) {
        const message = signUpError.message || 'Failed to sign up';
        setError(message);
        if (message.toLowerCase().includes('already registered') || message.toLowerCase().includes('duplicate')) {
          setError('This Gmail is already registered. Please sign in instead.');
        }
        isLoginInProgressRef.current = false;
      } else {
        setError('');
        setEmail('');
        setPassword('');
        alert('Sign up successful! Please check your email to confirm your account.');
        setIsSigningUp(false);
        isLoginInProgressRef.current = false;
      }
    } catch (err) {
      console.error('Sign up exception:', err);
      setError(err.message || 'An unexpected error occurred');
      isLoginInProgressRef.current = false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle Email/Password Sign In
   */
  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    isLoginInProgressRef.current = true;
    setIsLoading(true);
    setError('');

    try {
      if (!email || !password) {
        setError('Email and password are required');
        isLoginInProgressRef.current = false;
        setIsLoading(false);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message || 'Failed to sign in');
        isLoginInProgressRef.current = false;
      } else {
        console.log('✅ Email sign in successful');
        console.log('🔄 AuthFlow will detect auth state change and show account selector');
        // No need to navigate - AuthFlow will detect the auth state change via AuthContext
      }
    } catch (err) {
      console.error('Sign in exception:', err);
      setError('An unexpected error occurred');
      isLoginInProgressRef.current = false;
    } finally {
      setIsLoading(false);
    }
  };

  // Split UI into clear sections for maintainability
  const BeforeAuth = ({ onGoogle, errorMsg, signingUp, emailVal, setEmailVal, passwordVal, setPasswordVal, onEmailSignIn, onEmailSignUp, showAuthLoading }) => {
      // Always show the login card while auth is processing.

    // Otherwise, show the login card
    return (
      <div className="login-card" style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="login-header">
          <img
            src={getPublicAssetUrl('/LinkWhite.png')}
            alt="Joblink Logo"
            className="login-logo-image"
          />
        </div>

        {errorMsg && <div className="login-error-message">{errorMsg}</div>}

        <button onClick={onGoogle} className="btn-google" disabled={false} type="button">
          <FcGoogle size={28} />
          <span>Continue with Google</span>
        </button>

        <div className="login-footer">
          <p className="terms-text">
            By signing in, you agree to our{' '}
            <Link to="/terms" className="footer-link">Terms of Service</Link>{' '}
            and{' '}
            <Link to="/privacy" className="footer-link">Privacy Policy</Link>
          </p>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className={`login-container${isExiting && !Capacitor.isNativePlatform() ? ' exiting' : ''}`}>
        <div className="login-content" style={{ 
          opacity: 1, 
          pointerEvents: 'auto', 
          willChange: 'transform', 
          transform: 'translateZ(0)' 
        }}>
          <BeforeAuth
            onGoogle={handleGoogleSignIn}
            errorMsg={error}
            signingUp={isSigningUp}
            emailVal={email}
            setEmailVal={setEmail}
            passwordVal={password}
            setPasswordVal={setPassword}
            onEmailSignIn={handleEmailSignIn}
            onEmailSignUp={handleEmailSignUp}
            showAuthLoading={showAuthLoading}
          />
        </div>
      </div>

      {((isAuthenticated || shouldRedirect) && !authLoading && isExiting) && <Navigate to="/" replace />}
    </>
  );
}
