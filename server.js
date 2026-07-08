const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Load backend-specific .env first, then root .env as fallback.
const backendEnvPath = path.resolve(__dirname, '.env');
const rootEnvPath = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: backendEnvPath });
dotenv.config({ path: rootEnvPath, override: false });
console.log(`✅ Loaded env files: ${backendEnvPath}${process.env.PORT ? '' : ` (root fallback ${rootEnvPath} may be used)`}`);

// Import routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const feedbackRoutes = require('./routes/feedback');
const utilsRoutes = require('./routes/utils');
const { authLimiter } = require('./middleware/rateLimiter');
const { metricsMiddleware, register } = require('./metrics');
const { getAdminClient } = require('./supabaseAdmin');
const cache = require('./cache');

const app = express();

cache.initializeRedis().catch(() => {});

// Middleware
app.use(cors());
app.use(express.json());
app.use(metricsMiddleware);
const slowLogger = require('./middleware/slowLogger');
app.use(slowLogger(200));

// Routes
// Apply conservative rate limits to auth endpoints to reduce abusive traffic
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/utils', utilsRoutes);

// Server-side realtime listener: invalidate cache when follows change
try {
  const supabase = getAdminClient();
  if (supabase && typeof supabase.channel === 'function') {
    const channel = supabase.channel('server-follows-listener');
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'follows' }, (payload) => {
      try {
        const followedId = payload?.new?.followed_id || payload?.old?.followed_id;
        if (followedId) {
          cache.del(`followers_count:${followedId}`).catch(() => {});
          cache.del(`profile:id:${followedId}`).catch(() => {});
        }
      } catch (e) {
        console.warn('[realtime] follow event handling error', e?.message || e);
      }
    });
    try {
      channel.subscribe();
      console.log('✅ Subscribed to follows realtime events');
    } catch (e) {
      console.warn('⚠️ Realtime subscribe failed', e?.message || e);
    }
  }
} catch (e) {
  console.warn('⚠️ Failed to initialize realtime follow listener', e?.message || e);
}

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Backend server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// Start server
const PORT = process.env.BACKEND_PORT || process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ Joblink Backend running on port ${PORT}`);
  console.log(`📧 Email verification endpoint: POST /api/auth/verify-google-email`);
  console.log(`🔒 Admin endpoints mounted at: /api/admin`);
});

module.exports = app;
