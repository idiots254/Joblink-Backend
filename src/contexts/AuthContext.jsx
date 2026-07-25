import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import { Capacitor } from '@capacitor/core';
import { shouldHandleAuthCallback } from '../utils/authRouting';

// Diagnostic: indicate this module was loaded in the runtime
try { console.log('🔐 AuthContext module loaded'); } catch (e) {}

let startupNativeSetupStartedForUser = null;
let authInitializationPromise = null;

function resetStartupNativeSetupState() {
  startupNativeSetupStartedForUser = null;
}

function scheduleStartupNativeSetup(userId) {
  if (!userId || startupNativeSetupStartedForUser === userId) return;
  startupNativeSetupStartedForUser = userId;

  const runSetup = () => {
    tryRegisterFCM(userId).catch(err => console.warn('FCM on init failed:', err));
    tryRegisterWebDevice(userId).catch(err => console.warn('Web device registration failed:', err));
    // Notifications and location are non-critical on first paint; schedule them here too
    tryRegisterNotifications().catch(err => console.warn('Notifications init failed:', err));
    tryRegisterLocation(userId).catch(err => console.warn('Location init failed:', err));
  };

  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    try {
      window.requestIdleCallback(runSetup, { timeout: 3000 });
    } catch (e) {
      // fallback to timeout if requestIdleCallback throws for any reason
      window.setTimeout(runSetup, 3000);
    }
  } else {
    window.setTimeout(runSetup, 3000);
  }
}

// Request notification permission on first app launch
async function tryRegisterNotifications() {
  if (!Capacitor.isNativePlatform()) {
    console.log('ℹ️ Not a native platform, skipping notification registration');
    return;
  }

  if (Capacitor.getPlatform() !== 'android') {
    console.log('ℹ️ Notification registration skipped: not Android');
    return;
  }

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    
    // Check if we've already prompted for notifications on this device
    const notificationPromptedFlag = localStorage.getItem('_notificationPrompted');
    
    if (!notificationPromptedFlag) {
      console.log('First app launch: prompting for notification permission');
      const permission = await LocalNotifications.requestPermissions();
      
      // Mark that we've prompted, regardless of answer
      localStorage.setItem('_notificationPrompted', 'true');
      
      if (permission?.display === 'granted') {
        console.log('User granted notification permission on startup');
      } else {
        console.log('User denied notification permission on startup');
      }
    }
  } catch (err) {
    console.warn('tryRegisterNotifications failed:', err);
  }
}

// Lazy-load Location helper (request & position)
async function tryRegisterLocation(userId) {
  if (!Capacitor.isNativePlatform()) {
    console.log('ℹ️ Not a native platform, skipping location registration');
    return;
  }

  if (Capacitor.getPlatform() !== 'android') {
    console.log('ℹ️ Location registration skipped: not Android');
    return;
  }

  try {
    const { requestLocationPermission, getCurrentPosition } = await import('../notifications/registerLocation');

    // Check if we've already prompted for location on this device
    const locationPromptedFlag = localStorage.getItem('_locationPrompted');
    
    // Determine whether the user has opted in via Settings or previously
    let wantLocation = false;
    try {
      if (typeof window.getCurrentUserProfile === 'function') {
        const profile = await window.getCurrentUserProfile();
        if (profile && profile.allow_location) wantLocation = true;
      }
    } catch (e) {
      console.warn('Could not load profile to check allow_location:', e);
    }

    // Fallback to localStorage for unauthenticated or missing profile
    try {
      if (!wantLocation) {
        const stored = localStorage.getItem('allow_location');
        if (stored === 'true') wantLocation = true;
      }
    } catch (e) {
      /* ignore */
    }

    // If first time launching and user hasn't opted in yet, prompt for location
    if (!locationPromptedFlag && !wantLocation) {
      console.log('First app launch: prompting for location permission');
      const granted = await requestLocationPermission();
      
      // Mark that we've prompted, regardless of answer
      localStorage.setItem('_locationPrompted', 'true');
      
      if (granted) {
        console.log('User granted location permission on startup');
        wantLocation = true;
        // Save to profile
        try {
          if (typeof window.updateUserProfile === 'function') {
            await window.updateUserProfile({ allow_location: true });
          }
          localStorage.setItem('allow_location', 'true');
        } catch (e) {
          console.warn('Failed to save location preference:', e);
          localStorage.setItem('allow_location', 'true');
        }
      } else {
        console.log('User denied location permission on startup');
        wantLocation = false;
        // Save denial to profile
        try {
          if (typeof window.updateUserProfile === 'function') {
            await window.updateUserProfile({ allow_location: false });
          }
          localStorage.setItem('allow_location', 'false');
        } catch (e) {
          console.warn('Failed to save location denial:', e);
          localStorage.setItem('allow_location', 'false');
        }
      }
    }

    if (!wantLocation) {
      console.log('Location not enabled; skipping position capture');
      return;
    }

    // If location is enabled, fetch current position and persist coordinates
    try {
      const pos = await getCurrentPosition();
      if (pos && pos.coords) {
        try {
          if (typeof window.updateUserProfile === 'function') {
            await window.updateUserProfile({ last_known_lat: pos.coords.latitude, last_known_lng: pos.coords.longitude });
          }
        } catch (e) {
          console.warn('Failed to persist coordinates to profile:', e);
        }
      }
    } catch (e) {
      console.warn('Failed to get or persist current position:', e);
    }
  } catch (err) {
    console.warn('tryRegisterLocation failed:', err);
  }
}

/**
 * Authentication Context
 * Manages user authentication state and provides auth methods
 */
const AuthContext = createContext(null);

// Lazy-load web device registration for browser/desktop sessions
async function tryRegisterWebDevice(userId) {
  if (!userId) return;

  if (Capacitor.isNativePlatform()) {
    console.log('ℹ️ Native platform, skipping web device registration');
    return;
  }

  try {
    const { registerWebDevice } = await import('../notifications/registerWebDevice');
    console.log('🌐 Registering web device for user:', userId);
    await registerWebDevice(userId);
  } catch (err) {
    console.warn('⚠️ Web device registration failed:', err);
  }
}

// Lazy-load FCM registration (only for native platforms)
async function tryRegisterFCM(userId) {
  if (!Capacitor.isNativePlatform()) {
    console.log('ℹ️ Not a native platform, skipping FCM registration');
    return;
  }

  try {
    // Dynamic import to avoid loading on web
    const { default: registerFCM } = await import('../notifications/registerFCM');
    console.log('📱 Registering FCM for user:', userId);
    await registerFCM(userId);
  } catch (err) {
    console.warn('⚠️ FCM registration failed (may be normal on web):', err);
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isAwaitingCallback, setIsAwaitingCallback] = useState(false);
  const [error, setError] = useState(null);
  const userRef = useRef(user);
  const sessionRef = useRef(session);
  const deviceRevocationChannelRef = useRef(null);
  const deviceVerificationRef = useRef({ lastCheckedUserId: null, lastCheckedAt: 0 });

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    let isCancelled = false;

    const checkDeviceStillActive = async () => {
      try {
        const currentToken = (() => {
          try {
            return localStorage.getItem('device_token');
          } catch (e) {
            return null;
          }
        })();

        if (!user?.id || !currentToken) {
          return;
        }

        if (deviceVerificationRef.current.lastCheckedUserId === user.id) {
          return;
        }

        deviceVerificationRef.current.lastCheckedUserId = user.id;
        deviceVerificationRef.current.lastCheckedAt = Date.now();

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          return;
        }

        const { API_URL } = await import('../config');
        const response = await fetch(`${API_URL}/api/account/devices/verify`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'X-User-Id': user.id,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ token: currentToken })
        });

        if (isCancelled) return;

        if (!response.ok) {
          console.log('[Auth] Current device token was revoked or invalid, signing out');
          try {
            localStorage.removeItem('device_token');
            localStorage.removeItem('_authCached');
            localStorage.removeItem('_oauthInProgress');
          } catch (e) {
            /* ignore */
          }
          await supabase.auth.signOut();
          window.location.replace('/login');
        }
      } catch (err) {
        console.warn('[Auth] Device verification check failed:', err);
      }
    };

    if (!user?.id) {
      if (deviceRevocationChannelRef.current) {
        supabase.removeChannel(deviceRevocationChannelRef.current);
        deviceRevocationChannelRef.current = null;
      }
      return () => {
        isCancelled = true;
      };
    }

    if (deviceRevocationChannelRef.current) {
      return () => {
        isCancelled = true;
      };
    }

    checkDeviceStillActive();

    const channel = supabase.channel(`device-revocations-${user.id}`);
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'device_tokens'
      },
      async (payload) => {
        try {
          const affectedUserId = payload?.new?.user_id || payload?.old?.user_id;
          if (affectedUserId !== user.id) {
            return;
          }

          const revokedToken = payload?.eventType === 'DELETE' ? payload?.old?.token : payload?.new?.token;
          const currentStoredToken = (() => {
            try {
              return localStorage.getItem('device_token');
            } catch (e) {
              return null;
            }
          })();

          if (payload?.eventType === 'DELETE' && revokedToken && currentStoredToken && revokedToken === currentStoredToken) {
            try {
              localStorage.removeItem('device_token');
              localStorage.removeItem('_authCached');
              localStorage.removeItem('_oauthInProgress');
            } catch (e) {
              console.warn('[Auth] Failed to clear local auth storage after remote revoke:', e);
            }
            await supabase.auth.signOut();
            window.location.replace('/login');
          }
        } catch (err) {
          console.warn('[Auth] Failed to handle device revocation realtime event:', err);
        }
      }
    );

    const subscribeChannel = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          supabase.realtime.setAuth(session.access_token);
        }
      } catch (e) {
        console.warn('[Auth] Could not refresh realtime auth:', e);
      }

      channel.subscribe((status, err) => {
        if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !channel._closeCalled) {
          window.setTimeout(() => {
            subscribeChannel();
          }, 1500);
        }
      });
    };

    subscribeChannel();

    deviceRevocationChannelRef.current = channel;

    return () => {
      if (deviceRevocationChannelRef.current) {
        supabase.removeChannel(deviceRevocationChannelRef.current);
        deviceRevocationChannelRef.current = null;
      }
    };
  }, [user?.id]);

  const getUserProfile = useCallback(async () => {
    const currentUser = userRef.current;
    if (!currentUser) return null;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data || null;
    } catch (err) {
      console.error('Get profile error:', err);
      return null;
    }
  }, []);

  const updateUserProfile = useCallback(async (profileData) => {
    const currentUser = userRef.current;
    if (!currentUser) throw new Error('No user logged in');

    try {
      // normalize media files to ensure we only write serializable, minimal fields
      // avoid writing File objects or transient upload state
      const { normalizeProfileMediaFiles } = await import('../utils/profileMedia');
      const normalizedMedia = normalizeProfileMediaFiles(profileData);
      const dbPayload = {
        id: currentUser.id,
        full_name: profileData.name || profileData.full_name,
        email: profileData.email,
        phone: profileData.phone,
        title: profileData.title,
        bio: profileData.bio,
        location: profileData.location,
        skills: Array.isArray(profileData.skills) ? profileData.skills : (profileData.skills ? profileData.skills.split(',').map(s => s.trim()).filter(Boolean) : []),
        experience: profileData.experience,
        hourly_rate: profileData.hourlyRate || profileData.hourly_rate,
        availability: profileData.availability,
        certifications: Array.isArray(profileData.certifications) ? profileData.certifications : (profileData.certifications ? profileData.certifications.split(',').map(s => s.trim()).filter(Boolean) : []),
        project_types: Array.isArray(profileData.projectTypes) ? profileData.projectTypes : (profileData.projectTypes ? profileData.projectTypes.split(',').map(s => s.trim()).filter(Boolean) : []),
        work_style: profileData.workStyle || profileData.work_style,
        timezone: profileData.timezone,
        portfolio_website: profileData.portfolioWebsite || profileData.portfolio_website,
        github: profileData.github,
        linkedin: profileData.linkedin,
        twitter: profileData.twitter,
        instagram: profileData.instagram,
        facebook: profileData.facebook,
        tiktok: profileData.tiktok,
        whatsapp: profileData.whatsapp,
        avatar_url: profileData.avatar || profileData.avatar_url,
        media_files: normalizedMedia,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('profiles')
        .upsert(dbPayload);

      if (error) {
        const missingSchemaMatch = /Could not find the '(.+)' column of 'profiles' in the schema cache/i;
        const missingSchemaField = missingSchemaMatch.test(error.message) ? error.message.match(missingSchemaMatch)[1] : null;
        if (error.code === 'PGRST204' && missingSchemaField) {
          const altPayload = { ...dbPayload };
          if (missingSchemaField === 'credentials' && altPayload.credentials !== undefined) {
            altPayload.certifications = altPayload.credentials;
            delete altPayload.credentials;
          } else if (missingSchemaField === 'certifications' && altPayload.certifications !== undefined) {
            altPayload.credentials = altPayload.certifications;
            delete altPayload.certifications;
          }
          const shouldRetry = Object.keys(altPayload).length !== Object.keys(dbPayload).length ||
            Object.keys(altPayload).some(key => altPayload[key] !== dbPayload[key]);
          if (shouldRetry) {
            const { error: retryError } = await supabase.from('profiles').upsert(altPayload);
            if (!retryError) {
              return true;
            }
            console.error('Supabase retry upsert error:', retryError);
            throw retryError;
          }
        }
        console.error('Supabase upsert error:', error);
        throw error;
      }

      return true;
    } catch (err) {
      console.error('Update profile error:', err);
      throw err;
    }
  }, []);

  // Initialize auth state and listen for changes
  useEffect(() => {
    const initializeAuth = async () => {
      if (authInitializationPromise) {
        await authInitializationPromise;
        return;
      }

      authInitializationPromise = (async () => {
        try {
          console.log('🔐 AuthContext: Initializing auth...');
          
          // Check current session
          const {
            data: { session: currentSession },
            error: sessionError,
          } = await supabase.auth.getSession();

          console.log('🔐 AuthContext: Session check:', {
            hasSession: !!currentSession,
            email: currentSession?.user?.email
          });

          if (sessionError) {
            console.error('❌ Session error:', sessionError);
            setError(sessionError.message);
          }

          const callbackActive = typeof window !== 'undefined' && shouldHandleAuthCallback({ pathname: window.location.pathname, hash: window.location.hash, search: window.location.search });

          if (currentSession) {
            console.log('✅ AuthContext: Session found! Setting user:', currentSession.user.email);
            sessionRef.current = currentSession;
            userRef.current = currentSession.user;
            setSession(currentSession);
            setUser(currentSession.user);
            setIsAwaitingCallback(false);
            try { window.getCurrentUserProfile = getUserProfile; window.updateUserProfile = updateUserProfile; } catch (e) {}
            try { localStorage.setItem('_authCached', 'true'); } catch (e) { /* ignore */ }
            scheduleStartupNativeSetup(currentSession.user.id);
            setIsLoading(false);
          } else {
            console.warn('⚠️ AuthContext: No session found on init');
            if (callbackActive) {
              console.log('ℹ️ AuthContext: Auth callback detected during init, preserving callback state');
              setIsAwaitingCallback(true);
            } else {
              localStorage.removeItem('_authCached');
              setIsLoading(false);
            }
          }
        } catch (err) {
          console.error('❌ Auth initialization error:', err);
          setError(err.message);
          setIsLoading(false);
          throw err;
        }
      })();

      try {
        await authInitializationPromise;
      } catch (err) {
        // Intentionally ignored because the error is already surfaced above.
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('🔐 Auth state changed:', event, newSession?.user?.email);

      const rawParams = typeof window !== 'undefined'
        ? (window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.search.replace(/^[?]/, ''))
        : '';
      const params = new URLSearchParams(rawParams);
      const isCallbackRoute = shouldHandleAuthCallback({ pathname: window.location.pathname, hash: window.location.hash, search: window.location.search });

      const callbackActive = isCallbackRoute || params.has('access_token') || params.has('code') || params.has('refresh_token');

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (newSession?.user) {
          console.log('✅ AuthContext: User signed in / session initialized, setting state');
          sessionRef.current = newSession;
          userRef.current = newSession.user;
          setSession(newSession);
          setUser(newSession.user);
          setIsAwaitingCallback(false);
          try { window.getCurrentUserProfile = getUserProfile; window.updateUserProfile = updateUserProfile; } catch (e) {}
          try { localStorage.setItem('_authCached', 'true'); } catch (e) { /* ignore */ }
          scheduleStartupNativeSetup(newSession.user.id);
          setIsLoading(false);
        }
      } else if (event === 'INITIAL_SESSION') {
        if (newSession?.user) {
          console.log('✅ AuthContext: INITIAL_SESSION with valid session, setting state');
          sessionRef.current = newSession;
          userRef.current = newSession.user;
          setSession(newSession);
          setUser(newSession.user);
          setIsAwaitingCallback(false);
          try { window.getCurrentUserProfile = getUserProfile; window.updateUserProfile = updateUserProfile; } catch (e) {}
          try { localStorage.setItem('_authCached', 'true'); } catch (e) { /* ignore */ }
          scheduleStartupNativeSetup(newSession.user.id);
          setIsLoading(false);
        } else if (!callbackActive) {
          console.log('⚠️ AuthContext: INITIAL_SESSION fired with no session, clearing cached auth');
          resetStartupNativeSetupState();
          sessionRef.current = null;
          userRef.current = null;
          setSession(null);
          setUser(null);
          setIsAwaitingCallback(false);
          try { delete window.getCurrentUserProfile; delete window.updateUserProfile; } catch (e) {}
          try { localStorage.removeItem('_authCached'); } catch (e) { /* ignore */ }
          setIsLoading(false);
        } else {
          console.log('ℹ️ AuthContext: INITIAL_SESSION fired during auth callback, preserving state until callback completes');
          setIsAwaitingCallback(true);
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('🚪 AuthContext: User signed out');
        resetStartupNativeSetupState();
        sessionRef.current = null;
        userRef.current = null;
        setSession(null);
        setUser(null);
        setIsAwaitingCallback(false);
        try { delete window.getCurrentUserProfile; delete window.updateUserProfile; } catch (e) {}
        try { localStorage.removeItem('_authCached'); } catch (e) { /* ignore */ }
      }

      if (!callbackActive) {
        setIsLoading(false);
      }
    });

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [getUserProfile, updateUserProfile]);

  /**
   * Sign out the current user
   */
  const signOut = async () => {
    try {
      setIsSigningOut(true);
      setIsLoading(true);
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      userRef.current = null;
      sessionRef.current = null;
      setUser(null);
      setSession(null);
      setError(null);
    } catch (err) {
      console.error('Sign out error:', err);
      setError(err.message);
      throw err;
    } finally {
      try {
        localStorage.removeItem('device_token');
        localStorage.removeItem('_authCached');
        localStorage.removeItem('_oauthInProgress');
      } catch (e) {
        /* ignore */
      }
      try {
        window.dispatchEvent(new CustomEvent('oauthCompleted'));
      } catch (e) {
        /* ignore */
      }
      setIsSigningOut(false);
      setIsLoading(false);
    }
  };

  /**
   * Sign in with email and password
   */
  const signInWithEmail = async (email, password) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      setSession(data.session);
      setUser(data.user);
      try { localStorage.setItem('_authCached', 'true'); } catch (e) { /* ignore */ }
      // Defer native setup after sign in so startup remains responsive
      if (data.user?.id) {
        scheduleStartupNativeSetup(data.user.id);
      }
      return data;
    } catch (err) {
      console.error('Email sign in error:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Sign up with email and password
   */
  const signUpWithEmail = async (email, password) => {
    try {
      if (!email.toLowerCase().endsWith('@gmail.com')) {
        throw new Error('Only Gmail addresses are allowed for registration.');
      }

      setIsLoading(true);
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        const message = error.message || 'Failed to sign up';
        if (message.toLowerCase().includes('already registered') || message.toLowerCase().includes('duplicate')) {
          throw new Error('This Gmail is already registered. Please sign in instead.');
        }
        throw error;
      }

      return data;
    } catch (err) {
      console.error('Email sign up error:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Sign in with OAuth provider
   */
  const signInWithOAuth = async (provider) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        throw error;
      }

      return data;
    } catch (err) {
      console.error('OAuth sign in error:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    user,
    session,
    isLoading,
    isAwaitingCallback,
    isSigningOut,
    error,
    isAuthenticated: !!user,
    signOut,
    signInWithEmail,
    signUpWithEmail,
    signInWithOAuth,
    getUserProfile,
    updateUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to use authentication context
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
