Operational notes and recommended production changes

1) Redis
- Provision a Redis instance and set `REDIS_URL` in the backend environment (e.g. `redis://:password@host:6379/0`). The backend will use Redis for caching; if not present it falls back to in-memory.

2) Connection pooling / pgBouncer
- For high connection counts, enable Supabase connection pooling (pgBouncer) from the Supabase dashboard or deploy pgBouncer in front of your Postgres instance. This reduces connections from app servers and helps avoid "too many connections" errors.

3) Indexes / migrations
- Apply SQL in `backend/migrations/20260706_add_indexes.sql` to add recommended indexes for `profiles.email`, `follows.followed_id`, and `follows.follower_id`.

4) Monitoring & alerts
- Configure Supabase query/slow query alerts, and add logging/alerting for high error rates.
- Consider Prometheus + Grafana or SaaS APM for application metrics. The project includes a `slowLogger` middleware to log slow requests.

5) Caching
- Use Redis for production caching of hot reads (follower counts, frequently requested profiles). The backend provides `/api/utils/followers-count` as an example.

6) Rate limiting
- `express-rate-limit` is added and applied to `/api/auth`. Tune `windowMs`/`max` based on expected traffic.

7) Security
- Never expose service role keys to the browser. Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only.
