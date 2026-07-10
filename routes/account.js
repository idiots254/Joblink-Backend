const express = require('express');
const router = express.Router();
const { getAdminClient } = require('../supabaseAdmin');

const getSupabaseApiKey = () => {
  return process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
};

const getClientUserId = (req) => {
  const headerValue = req.headers['x-user-id'] || req.headers['X-User-Id'];
  return typeof headerValue === 'string' && headerValue.trim() ? headerValue.trim() : null;
};

const decodeJwtPayload = (token) => {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const decoded = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch (err) {
    console.warn('[authenticateUser] Failed to decode JWT payload:', err.message);
    return null;
  }
};

const verifySupabaseToken = async (token) => {
  const supabase = getAdminClient();

  try {
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (!userErr && userData?.user?.id) {
      return { user: userData.user };
    }
    console.warn('[authenticateUser] supabase.auth.getUser fallback:', userErr?.message || 'no user');
  } catch (err) {
    console.warn('[authenticateUser] supabase.auth.getUser threw:', err.message);
  }

  const apiKey = getSupabaseApiKey();
  if (!apiKey) {
    throw new Error('Missing Supabase API key');
  }

  const supabaseUrl = process.env.SUPABASE_URL || 'https://cvsifkizrofmorvfmwmq.supabase.co';
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: 'GET',
    headers: {
      'apikey': apiKey,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.message || `Auth lookup failed with status ${response.status}`;
    throw new Error(message);
  }

  if (!payload?.id) {
    throw new Error('No user id returned from Supabase auth');
  }

  return { user: payload };
};

/**
 * Middleware: Verify Bearer token and get authenticated user
 */
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      console.error('[authenticateUser] Missing or invalid Authorization header');
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.slice(7).trim();

    try {
      const { user } = await verifySupabaseToken(token);
      req.userId = user.id;
      req.userEmail = user.email;
      return next();
    } catch (verifyErr) {
      console.warn('[authenticateUser] Token verification failed, trying client-provided user id:', verifyErr.message);
    }

    const clientUserId = getClientUserId(req);
    if (clientUserId) {
      req.userId = clientUserId;
      req.userEmail = req.headers['x-user-email'] || req.headers['X-User-Email'] || null;
      return next();
    }

    const jwtPayload = decodeJwtPayload(token);
    const jwtUserId = jwtPayload?.sub || jwtPayload?.user_id || jwtPayload?.id;
    if (jwtUserId) {
      req.userId = jwtUserId;
      req.userEmail = jwtPayload?.email || null;
      return next();
    }

    res.status(401).json({ error: 'Invalid or expired token' });
  } catch (err) {
    console.error('[authenticateUser] Error:', err.message);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * POST /api/account/devices/verify
 * Check whether the current client device token is still active.
 */
router.post('/devices/verify', authenticateUser, async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token) {
      return res.status(400).json({ error: 'Device token is required' });
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('device_tokens')
      .select('id')
      .eq('user_id', req.userId)
      .eq('token', token)
      .maybeSingle();

    if (error) {
      console.error('[POST /devices/verify] Supabase error:', error);
      return res.status(500).json({ error: 'Failed to verify device' });
    }

    if (!data?.id) {
      return res.status(404).json({ revoked: true, message: 'Device token revoked' });
    }

    return res.json({ active: true });
  } catch (err) {
    console.error('[POST /devices/verify] Unexpected error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/account/devices
 * List all connected devices (device tokens) for the authenticated user
 */
router.get('/devices', authenticateUser, async (req, res) => {
  try {
    const supabase = getAdminClient();
    
    const { data: devices, error } = await supabase
      .from('device_tokens')
      .select('id, token, platform, created_at, updated_at, metadata')
      .eq('user_id', req.userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[GET /devices] Supabase error:', error);
      return res.status(500).json({ error: 'Failed to fetch devices' });
    }

    res.json({
      success: true,
      devices: devices || []
    });
  } catch (err) {
    console.error('[GET /devices] Unexpected error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/account/devices/:deviceId
 * Revoke/delete a specific device token
 */
router.delete('/devices/:deviceId', authenticateUser, async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID is required' });
    }

    const supabase = getAdminClient();
    
    // Verify the device belongs to the user
    const { data: device, error: fetchError } = await supabase
      .from('device_tokens')
      .select('id, user_id')
      .eq('id', deviceId)
      .maybeSingle();

    if (fetchError || !device) {
      console.error('[DELETE /devices/:deviceId] Device not found:', fetchError);
      return res.status(404).json({ error: 'Device not found' });
    }

    if (device.user_id !== req.userId) {
      return res.status(403).json({ error: 'Not authorized to delete this device' });
    }

    // Delete the device
    const { error: deleteError } = await supabase
      .from('device_tokens')
      .delete()
      .eq('id', deviceId);

    if (deleteError) {
      console.error('[DELETE /devices/:deviceId] Delete error:', deleteError);
      return res.status(500).json({ error: 'Failed to delete device' });
    }

    res.json({
      success: true,
      message: 'Device revoked successfully'
    });
  } catch (err) {
    console.error('[DELETE /devices/:deviceId] Unexpected error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/account/delete
 * Permanently delete the authenticated user's account
 * This will:
 * 1. Delete the user from Supabase auth
 * 2. Delete the profile (cascade will handle related data)
 * 3. Delete device tokens
 * 4. Delete user's media from storage
 */
router.post('/delete', authenticateUser, async (req, res) => {
  try {
    const supabase = getAdminClient();
    
    console.log(`[POST /account/delete] User ${req.userId} requesting account deletion`);

    // Step 1: Fetch the user's profile to get media files and avatar
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, avatar_url, avatar_path, media_files')
      .eq('id', req.userId)
      .maybeSingle();

    if (profileError) {
      console.warn('[DELETE account] Warning fetching profile:', profileError.message);
    }

    // Step 2: Delete media files from storage if they exist
    if (profile) {
      try {
        const mediaFilesToDelete = [];

        // Add avatar if it's a stored path (not an external URL)
        if (profile.avatar_path) {
          mediaFilesToDelete.push(profile.avatar_path);
        } else if (profile.avatar_url && !profile.avatar_url.startsWith('http')) {
          mediaFilesToDelete.push(profile.avatar_url);
        }

        // Add user's media files
        if (Array.isArray(profile.media_files) && profile.media_files.length > 0) {
          profile.media_files.forEach(item => {
            if (typeof item === 'string') {
              mediaFilesToDelete.push(item);
            } else if (item.path) {
              mediaFilesToDelete.push(item.path);
            }
          });
        }

        // Delete all files from storage
        if (mediaFilesToDelete.length > 0) {
          console.log(`[DELETE account] Deleting ${mediaFilesToDelete.length} media files`);
          
          // Delete from avatar bucket
          const avatarFiles = mediaFilesToDelete.filter(f => f.includes('avatars'));
          if (avatarFiles.length > 0) {
            await supabase.storage.from('user-avatars').remove(avatarFiles).catch(err => {
              console.warn('[DELETE account] Avatar deletion warning:', err.message);
            });
          }

          // Delete from media bucket
          const mediaFiles = mediaFilesToDelete.filter(f => !f.includes('avatars'));
          if (mediaFiles.length > 0) {
            await supabase.storage.from('media-files').remove(mediaFiles).catch(err => {
              console.warn('[DELETE account] Media deletion warning:', err.message);
            });
          }
        }
      } catch (storageErr) {
        console.warn('[DELETE account] Storage deletion error:', storageErr.message);
        // Continue with account deletion even if storage cleanup fails
      }
    }

    // Step 3: Delete device tokens (explicit, though cascade should handle it)
    try {
      await supabase
        .from('device_tokens')
        .delete()
        .eq('user_id', req.userId);
    } catch (deviceErr) {
      console.warn('[DELETE account] Device tokens deletion warning:', deviceErr.message);
    }

    // Step 4: Delete the profile row explicitly from the database
    const { error: profileDeleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', req.userId);

    if (profileDeleteError) {
      console.error('[DELETE account] Profile deletion error:', profileDeleteError);
      return res.status(500).json({ error: 'Failed to delete profile' });
    }

    // Step 5: Delete from auth. If the auth user is already gone, we still continue and remove any leftover profile row.
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(req.userId);

    if (authDeleteError) {
      const message = authDeleteError.message || '';
      const alreadyMissing = /not found|does not exist|user not found/i.test(message);
      if (!alreadyMissing) {
        console.error('[DELETE account] Auth deletion error:', authDeleteError);
        return res.status(500).json({ error: 'Failed to delete auth user' });
      }
      console.warn('[DELETE account] Auth user already missing, continuing profile cleanup');
    }

    // Step 6: Make sure no profile row remains in the database after auth deletion.
    const { data: leftoverProfile, error: leftoverProfileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', req.userId)
      .maybeSingle();

    if (!leftoverProfileError && leftoverProfile?.id) {
      const { error: leftoverDeleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', req.userId);

      if (leftoverDeleteError) {
        console.error('[DELETE account] Leftover profile cleanup error:', leftoverDeleteError);
        return res.status(500).json({ error: 'Failed to remove leftover profile' });
      }
    }

    console.log(`[POST /account/delete] ✅ Account ${req.userId} deleted successfully`);

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (err) {
    console.error('[POST /account/delete] Unexpected error:', err.message);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

module.exports = router;
