import React, { createContext, useContext, useCallback, useState, useRef, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from './AuthContext';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { createInFlightRequestGuard } from '../utils/requestGuard';

function parseJsonMaybe(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return value;
  }
}

function getNotificationTargetId(extra = {}) {
  const likeRow = parseJsonMaybe(extra?.like_row) || parseJsonMaybe(extra?.data?.like_row) || {};
  return extra?.target_id || extra?.target_profile || extra?.profile_id || extra?.target || extra?.target_user_id || extra?.to_user_id || extra?.receiver_id || extra?.liked_profile_id || extra?.liked_profile || likeRow?.liked_profile_id || likeRow?.liked_profile || likeRow?.target_id || likeRow?.target || '';
}

function getNotificationActorId(extra = {}) {
  const likeRow = parseJsonMaybe(extra?.like_row) || parseJsonMaybe(extra?.data?.like_row) || {};
  return extra?.actor_id || extra?.actor || extra?.liker_id || extra?.user_id || extra?.from_user_id || extra?.created_by || likeRow?.liker_id || likeRow?.actor_id || '';
}

const NotificationContext = createContext(null);

let nextId = 1;

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [toastVersion, setToastVersion] = useState(0);
  const [toasts, setToasts] = useState([]);
  const toastsRef = useRef([]);
  const recentShownNotificationsRef = useRef(new Map());
  const scheduledLocalNotificationIdsRef = useRef(new Set());
  const showToastRef = useRef(null);
  const showLocalNotificationRef = useRef(null);
  const hiddenNotificationIdsRef = useRef(new Set());
  const notificationFetchGuardRef = useRef(createInFlightRequestGuard(15000));
  const { user } = useAuth();

  useEffect(() => {
    toastsRef.current = [];
    scheduledLocalNotificationIdsRef.current.clear();
  }, []);

  // Clear stale toasts on mount (app startup)
  useEffect(() => {
    toastsRef.current = [];
  }, []);

  const normalizeNotification = (rec) => {
    if (!rec) return rec;
    const title = rec.title || rec.type || '';
    const message = rec.message || rec.body || rec.description || '';
    return {
      ...rec,
      id: String(rec.id),
      title,
      message,
      body: rec.body || message,
      data: rec.data || {},
      read: rec.read || false,
    };
  };

  const isNotificationHidden = useCallback((id) => hiddenNotificationIdsRef.current.has(String(id)), []);
  const hideNotificationIds = useCallback((ids) => {
    const hiddenIds = hiddenNotificationIdsRef.current;
    ids.forEach((id) => hiddenIds.add(String(id)));
  }, []);

  const showToast = useCallback(({ type = 'info', title = '', message = '' }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const toast = { id, type, title, message, timestamp: Date.now() };

    toastsRef.current = [toast, ...toastsRef.current];
    setToasts((prev) => [toast, ...prev]);
    setToastVersion((v) => v + 1);

    window.setTimeout(() => {
      toastsRef.current = toastsRef.current.filter((t) => t.id !== id);
      setToasts((prev) => prev.filter((t) => t.id !== id));
      setToastVersion((v) => v + 1);
    }, 1400);
  }, []);
  showToastRef.current = showToast;

  const registerShownNotification = useCallback(({ key, ttl = 5000 }) => {
    const keys = Array.isArray(key) ? key : [key];
    const now = Date.now();
    const map = recentShownNotificationsRef.current;
    const validKeys = keys.filter(Boolean);
    if (!validKeys.length) return false;

    for (const k of validKeys) {
      const existingExpiry = map.get(k);
      if (existingExpiry && existingExpiry > now) {
        return false;
      }
    }

    const hasLocalKey = validKeys.some((k) => String(k).startsWith('local:'));
    const expiry = now + (hasLocalKey ? 1000 * 60 * 5 : ttl);
    for (const k of validKeys) {
      map.set(k, expiry);
    }

    // cleanup expired keys periodically
    setTimeout(() => {
      const mapCleanup = recentShownNotificationsRef.current;
      for (const [k, exp] of mapCleanup.entries()) {
        if (exp <= Date.now()) mapCleanup.delete(k);
      }
    }, ttl + 1000);
    return true;
  }, []);

  const requestLocalNotificationPermission = useCallback(async () => {
    try {
      if (Capacitor.isNativePlatform && Capacitor.isNativePlatform()) {
        const permission = await LocalNotifications.requestPermissions();
        console.log('[NotificationContext] LocalNotifications permission:', permission);
        return permission?.display === 'granted';
      }
    } catch (e) {
      console.warn('Failed to request local notification permissions:', e);
    }

    return false;
  }, []);

  const getNotificationDedupeKeys = useCallback((title, message, extra = {}) => {
    const semanticTargetId = getNotificationTargetId(extra);
    const keys = [];
    if (extra?.dedupeKey) {
      if (Array.isArray(extra.dedupeKey)) {
        keys.push(...extra.dedupeKey.filter(Boolean));
      } else {
        keys.push(extra.dedupeKey);
      }
    }
    if (extra?.notification_id !== undefined && extra?.notification_id !== null) {
      keys.push(`local:${String(extra.notification_id)}`);
    }
    const actorIdentifier = String(getNotificationActorId(extra) || extra?.actor_name || '');
    if (extra?.type && (actorIdentifier || semanticTargetId)) {
      keys.push(`interaction:${String(extra.type)}:${actorIdentifier}:${String(semanticTargetId)}`);
      if (extra?.actor_id && extra?.actor_name && String(extra.actor_name) !== String(extra.actor_id)) {
        keys.push(`interaction:${String(extra.type)}:${String(extra.actor_name)}:${String(semanticTargetId)}`);
      }
      if (!extra?.actor_id && !extra?.actor_name) {
        keys.push(`interaction:${String(extra.type)}::${String(semanticTargetId)}`);
      }
    }
    if (!keys.length) {
      keys.push(`${title}:${message}`);
    }
    return [...new Set(keys)];
  }, []);

  const getNotificationDedupeKey = useCallback((title, message, extra = {}) => {
    return getNotificationDedupeKeys(title, message, extra)[0];
  }, [getNotificationDedupeKeys]);

  const getLocalNotificationId = useCallback((notificationId) => {
    if (notificationId === undefined || notificationId === null) {
      return undefined;
    }
    if (typeof notificationId === 'number') {
      return notificationId;
    }
    const value = String(notificationId);
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = ((hash << 5) - hash) + value.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }, []);

  const cancelLocalNotification = useCallback(async (notificationId) => {
    try {
      const localId = getLocalNotificationId(notificationId);
      if (localId === undefined) return;
      await LocalNotifications.cancel({ notifications: [{ id: localId }] });
      scheduledLocalNotificationIdsRef.current.delete(localId);
      console.log('[NotificationContext] Canceled local notification', localId);
    } catch (e) {
      console.warn('[NotificationContext] Failed to cancel local notification', e);
    }
  }, [getLocalNotificationId]);

  // Show a local notification (toast-like) on mobile
  const showLocalNotification = useCallback(async (title, message, badge, extra = {}, options = {}) => {
    const toastPayload = {
      type: 'info',
      title: title || 'New Notification',
      message: message || 'You have a new update',
    };

    if (process.env.NODE_ENV === 'development') {
      console.debug('[NotificationContext] showLocalNotification called', { title, message, badge, isNative: Capacitor.isNativePlatform && Capacitor.isNativePlatform() });
    }

    const notificationDedupeKeys = getNotificationDedupeKeys(title, message, extra);
    const shouldForceShow = Boolean(options?.forceShow || extra?.forceShow || extra?.source === 'realtime');
    if (!shouldForceShow && !registerShownNotification({ key: notificationDedupeKeys, ttl: 10000 })) {
      console.log('[NotificationContext] Skipping duplicate local notification:', notificationDedupeKeys);
      return;
    }

    try {
      const isVisible = typeof document !== 'undefined' && document.visibilityState === 'visible';
      if (!(Capacitor.isNativePlatform && Capacitor.isNativePlatform()) || shouldForceShow) {
        if (process.env.NODE_ENV === 'development') {
          console.debug('[NotificationContext] Using in-app toast for realtime notification');
        }
        showToastRef.current?.(toastPayload);
        return;
      }

      const platform = (Capacitor.getPlatform && Capacitor.getPlatform()) || (Capacitor.platform || 'native');
      const isAndroid = String(platform).toLowerCase() === 'android';

      // Ensure we have permission before scheduling
      try {
        await requestLocalNotificationPermission();
      } catch (e) {
        console.warn('[NotificationContext] requestLocalNotificationPermission failed', e);
      }

      // On Android we schedule a native banner (heads-up) even when app is foregrounded.
      // On iOS/web, prefer in-app toasts when visible to avoid duplicates.
      if (isVisible && !isAndroid && !options?.forceShow) {
        if (process.env.NODE_ENV === 'development') {
          console.debug('[NotificationContext] Native app visible and not Android — using in-app toast instead of native notification');
        }
        showToastRef.current?.(toastPayload);
        return;
      }

      const notificationTitle = title || 'New Notification';
      const localId = getLocalNotificationId(extra?.notification_id || extra?.id) ?? Math.floor(Math.random() * 1000000);

      if (scheduledLocalNotificationIdsRef.current.has(localId)) {
        if (process.env.NODE_ENV === 'development') {
          console.debug('[NotificationContext] Skipping already scheduled local notification id:', localId);
        }
        return;
      }

      const notificationPayload = {
        title: notificationTitle,
        body: message || 'You have a new update',
        id: localId,
        smallIcon: 'ic_linkwhite',
        channelId: 'notifications', // Use the channel created in MainActivity
        importance: 'high', // High importance for head-up notifications
        ongoing: false,
        sound: 'default',
        vibrate: true,
        number: typeof badge === 'number' ? Math.max(0, badge) : 0,
        badge: typeof badge === 'number' ? Math.max(0, badge) : 0,
        color: '#FFFFFF',
        actionTypeId: 'notification_actions',
        extra: {
          source: 'app_notification',
          ...extra,
          notification_id: extra?.notification_id || extra?.id || null,
        },
        largeIcon: 'ic_linkwhite',
      };
      if (process.env.NODE_ENV === 'development') {
        console.debug('[NotificationContext] Local notification badge set to:', notificationPayload.badge, 'unread count:', badge);
      }

      const result = await LocalNotifications.schedule({
        notifications: [notificationPayload],
      });
      scheduledLocalNotificationIdsRef.current.add(localId);
      if (process.env.NODE_ENV === 'development') {
        console.debug('[NotificationContext] Scheduled native local notification', notificationPayload, { result });
      }
    } catch (e) {
      console.warn('[NotificationContext] Failed to show local notification; falling back to in-app toast', e);
      showToastRef.current?.(toastPayload);
    }
  }, [requestLocalNotificationPermission, getLocalNotificationId, getNotificationDedupeKeys, registerShownNotification]);
  showLocalNotificationRef.current = showLocalNotification;

  const markRead = useCallback(async (id) => {
    hiddenNotificationIdsRef.current.add(String(id));
    setNotifications((s) => s.filter(n => n.id !== id));
    try {
      await cancelLocalNotification(id);
      await supabase.from('notifications').update({ read: true }).match({ id });
    } catch (e) {
      console.warn('Failed to mark notification read in DB', e);
    }
  }, [cancelLocalNotification]);

  useEffect(() => {
    if (!(Capacitor.isNativePlatform && Capacitor.isNativePlatform())) {
      return;
    }

    async function registerNotificationActions() {
      try {
        await LocalNotifications.registerActionTypes({
          types: [
            {
              id: 'notification_actions',
              actions: [
                { id: 'view', title: 'View', foreground: true },
                { id: 'mark_read', title: 'Mark as Read', foreground: true },
              ],
            },
          ],
        });
      } catch (err) {
        console.warn('[NotificationContext] Failed to register notification actions:', err);
      }
    }

    registerNotificationActions();

    let actionListener = null;
    const setupActionListener = async () => {
      try {
        actionListener = await LocalNotifications.addListener('localNotificationActionPerformed', async (notificationAction) => {
          const actionId = notificationAction?.actionId;
          const extraData = notificationAction?.notification?.extra || notificationAction?.notification?.data || {};

          if (actionId === 'view') {
            window.onNotificationTap?.({ action: 'view', deep: '/notifications', data: extraData });
          }

          if (actionId === 'mark_read') {
            const notificationId = extraData?.notification_id || extraData?.id || null;
            if (notificationId) {
              try {
                await markRead(notificationId);
              } catch (err) {
                console.warn('[NotificationContext] Failed to mark notification read:', err);
              }
            }
          }
        });
      } catch (err) {
        console.warn('[NotificationContext] Failed to setup action listener:', err);
      }
    };
    setupActionListener();

    return () => {
      try {
        actionListener?.remove?.();
      } catch (e) {
        console.warn('Failed to remove actionListener:', e);
      }
    };
  }, [markRead]);

  // Expose FCM notification handler to registerFCM
  useEffect(() => {
    window.showFCMNotification = async ({ title, body, badge, data }) => {
      console.log('[NotificationContext] FCM notification received:', { title, body, badge, data });

      const actorName = data?.actor_name || data?.actor || 'Someone';
      const type = data?.type || null;
      const notificationPreview = type === 'like'
        ? `${actorName} liked your profile`
        : type === 'follow'
        ? `${actorName} started following you`
        : body || 'You have a new notification.';

      console.log('[NotificationContext] Skipping local display for foreground FCM; notification table polling will handle it.', { notificationPreview });
    };

    return () => {
      delete window.showFCMNotification;
    };
  }, []);
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    let canceled = false;
    let pollInterval;
    let lastRefetchAt = 0;
    const REFETCH_COOLDOWN_MS = 30000;

    const refetchNotifications = async () => {
      const now = Date.now();
      if (now - lastRefetchAt < REFETCH_COOLDOWN_MS) {
        return;
      }
      lastRefetchAt = now;
      if (canceled) return;

      const guarded = await notificationFetchGuardRef.current.run(async () => {
        const { data, error } = await supabase
          .from('notifications')
          .select('id, title, body, read, type, actor_id, data, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(25);

        if (error) {
          console.warn('[NotificationContext] Failed to load notifications:', error);
          return null;
        }

        if (!canceled && data) {
          setNotifications((prev) => {
            const prevIds = new Set(prev.map((n) => n.id));
            const seenIds = new Set();
            const seenKeys = new Set();
            const newNotifications = (data || [])
              .map(normalizeNotification)
              .filter((n) => {
                const isRead = n?.read === true || n?.read === 'true';
                return !isRead && !isNotificationHidden(n.id);
              })
              .filter((notif) => {
                if (seenIds.has(notif.id)) return false;
                seenIds.add(notif.id);
                const targetId = notif.data?.target_id || notif.data?.target_profile || notif.data?.target || notif.data?.profile_id || notif.data?.target_user_id || notif.data?.to_user_id || notif.data?.receiver_id || (notif.data?.like_row && (notif.data.like_row.liked_profile_id || notif.data.like_row.liked_profile)) || notif.data?.to || '';
                const key = getNotificationDedupeKey(notif.title, notif.message, {
                  type: notif.type || notif.data?.type || null,
                  actor_id: notif.actor_id || null,
                  actor_name: notif.data?.actor_name || notif.data?.actor || null,
                  target_id: targetId,
                });
                if (seenKeys.has(key)) return false;
                seenKeys.add(key);
                return true;
              });

            (async () => {
              for (const notif of newNotifications) {
                if (!prevIds.has(notif.id)) {
                  const badgeCount = newNotifications.filter((n) => !n.read).length;
                  let actorName = notif.data?.actor_name || notif.data?.actor || notif.actor_id || 'Someone';
                  if ((!actorName || actorName === String(notif.actor_id)) && notif.actor_id) {
                    actorName = String(notif.actor_id);
                  }

                  const type = notif.type || notif.data?.type || null;
                  const targetId = notif.data?.target_id || notif.data?.target_profile || notif.data?.target || notif.data?.profile_id || notif.data?.target_user_id || notif.data?.to_user_id || notif.data?.receiver_id || (notif.data?.like_row && (notif.data.like_row.liked_profile_id || notif.data.like_row.liked_profile)) || notif.data?.to || '';
                  const displayTitle = type === 'like'
                    ? 'Liked'
                    : type === 'follow'
                    ? 'Followed'
                    : (notif.title || 'Notification');
                  const displayBody = type === 'like'
                    ? `${actorName} liked your profile`
                    : type === 'follow'
                    ? `${actorName} followed you`
                    : (notif.message || notif.body || 'You have a new notification.');

                  const dbDedupeKeys = getNotificationDedupeKeys(displayTitle, displayBody, {
                    type,
                    actor_id: notif.actor_id || null,
                    actor_name: actorName,
                    actor_avatar: notif.data?.actor_avatar || notif.data?.actor_image || null,
                    target_id: targetId,
                  });

                  await showLocalNotification(displayTitle, displayBody, badgeCount, {
                    notification_id: notif.id,
                    type,
                    actor_id: notif.actor_id || null,
                    actor_name: actorName,
                    actor_avatar: notif.data?.actor_avatar || notif.data?.actor_image || null,
                    source: 'db',
                    target_id: targetId,
                    dedupeKey: dbDedupeKeys,
                  });
                }
              }
            })();

            const mergedNotifications = [...prev];
            for (const notif of newNotifications) {
              if (!mergedNotifications.some((item) => String(item.id) === String(notif.id))) {
                mergedNotifications.unshift(notif);
              }
            }
            return mergedNotifications.slice(0, 100);
          });
        }

        return data;
      });

      if (guarded.skipped) {
        return;
      }

      if (guarded.result === null) {
        return;
      }
    };

    const load = async () => {
      // Load initial notifications
      await refetchNotifications();

      // Poll only once every five minutes and only when the page is visible.
      pollInterval = setInterval(async () => {
        if (document.visibilityState === 'visible' && !canceled) {
          await refetchNotifications();
        }
      }, 300000);

      // Re-fetch when page becomes visible
      const handleVisibility = async () => {
        if (document.visibilityState === 'visible') {
          console.log('[NotificationContext] Page became visible, re-fetching...');
          await refetchNotifications();
        }
      };

      document.addEventListener('visibilitychange', handleVisibility);

      let appStateListener = null;
      try {
        if (Capacitor.isNativePlatform && Capacitor.isNativePlatform()) {
          appStateListener = await CapacitorApp.addListener('appStateChange', async (state) => {
            if (state?.isActive) {
              console.log('[NotificationContext] App became active, re-fetching...');
              await refetchNotifications();
            }
          });
        }
      } catch (e) {
        console.warn('Failed to set up app state listener:', e);
      }

      const cleanup = async () => {
        try { clearInterval(pollInterval); } catch (e) {}
        try { document.removeEventListener('visibilitychange', handleVisibility); } catch (e) {}
        try { appStateListener?.remove?.(); } catch (e) {}
      };

      return cleanup;
    };

    let innerCleanup;
    (async () => {
      innerCleanup = await load();
    })();

    return () => {
      canceled = true;
      (async () => {
        if (innerCleanup) await innerCleanup();
      })();
    };
  }, [user, showLocalNotification, getNotificationDedupeKey, getNotificationDedupeKeys, isNotificationHidden]);

  const addNotification = useCallback(({ type = 'info', title = '', message = '', persist = false }) => {
    const id = String(nextId++);
    const n = { id, type, title, message, timestamp: Date.now(), read: false };
    setNotifications((s) => [n, ...s]);
    return id;
  }, []);

  const removeNotification = useCallback(async (id) => {
    hiddenNotificationIdsRef.current.add(String(id));
    setNotifications((s) => s.filter(n => n.id !== id));
    try {
      await cancelLocalNotification(id);
      await supabase.from('notifications').delete().match({ id });
    } catch (e) {
      console.warn('Failed to remove notification from DB', e);
    }
  }, [cancelLocalNotification]);

  const clearNotifications = useCallback(async () => {
    hideNotificationIds(notifications.map((notif) => notif.id));
    setNotifications([]);
    notifications.forEach((notif) => {
      if (!notif.read) {
        cancelLocalNotification(notif.id);
      }
    });
    if (!user) return;
    try {
      await supabase.from('notifications').update({ read: true }).eq('user_id', user.id);
    } catch (e) {
      console.warn('Failed to mark all notifications read in DB', e);
    }
  }, [user, notifications, cancelLocalNotification, hideNotificationIds]);

  const value = {
    notifications,
    addNotification,
    removeNotification,
    markRead,
    clearNotifications,
    showToast,
    showLocalNotification,
    toastVersion,
    toasts,
    _toastsRef: toastsRef,
    registerShownNotification,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}

export default NotificationContext;
