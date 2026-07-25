-- Supabase SQL: profiles, profile counts, user_type, notifications, and device tokens
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email text,
  display_name text,
  full_name text,
  avatar_url text,
  avatar_path text,
  phone text,
  title text,
  bio text,
  location text,
  user_type text DEFAULT 'employee',
  rating real DEFAULT 4.5,
  skills text[] DEFAULT '{}'::text[],
  experience text,
  availability text DEFAULT 'Available',
  languages text[] DEFAULT '{}'::text[],
  credentials text[] DEFAULT '{}'::text[],
  certifications text[] DEFAULT '{}'::text[],
  timezone text,
  project_types text[] DEFAULT '{}'::text[],
  work_style text,
  portfolio_website text,
  github text,
  linkedin text,
  twitter text,
  instagram text,
  facebook text,
  tiktok text,
  whatsapp text,
  media_files jsonb DEFAULT '[]'::jsonb,
  reviews jsonb DEFAULT '[]'::jsonb,
  followers integer DEFAULT 0,
  like_count integer DEFAULT 0,
  view_count integer DEFAULT 0,
  completed_projects integer DEFAULT 0,
  response_time text DEFAULT '< 1 hour',
  hourly_rate text,
  allow_screenshots boolean DEFAULT true,
  allow_location boolean DEFAULT false,
  last_known_lat double precision,
  last_known_lng double precision,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_active_at timestamptz,
  subscription_tier text DEFAULT 'free',
  subscription_started_at timestamptz,
  subscription_expires_at timestamptz,
  role text DEFAULT 'user',
  is_suspended boolean DEFAULT false,
  suspended_reason text,
  suspended_at timestamptz
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS credentials text[] DEFAULT '{}'::text[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS certifications text[] DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles (email);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique_idx ON public.profiles (email);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles (role);
CREATE INDEX IF NOT EXISTS profiles_created_at_idx ON public.profiles (created_at DESC);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can read their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Public profiles are viewable" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  actor_id uuid,
  type text NOT NULL,
  title text,
  body text,
  data jsonb DEFAULT '{}'::jsonb,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_actor FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications (user_id, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;

CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Anyone can insert notifications" ON public.notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND (auth.uid() = user_id OR auth.uid() = actor_id));
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own notifications" ON public.notifications FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.device_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS device_tokens_user_token_idx ON public.device_tokens (user_id, token);

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own device tokens" ON public.device_tokens;
DROP POLICY IF EXISTS "Users can insert their own device tokens" ON public.device_tokens;
DROP POLICY IF EXISTS "Users can delete their own device tokens" ON public.device_tokens;

CREATE POLICY "Users can view their own device tokens" ON public.device_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own device tokens" ON public.device_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own device tokens" ON public.device_tokens FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.profile_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  viewed_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS profile_views_unique_viewer_viewed_idx ON public.profile_views (viewer_id, viewed_profile_id);

ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view profile views" ON public.profile_views;
DROP POLICY IF EXISTS "Anyone can insert profile views" ON public.profile_views;

CREATE POLICY "Anyone can view profile views" ON public.profile_views FOR SELECT USING (true);
CREATE POLICY "Anyone can insert profile views" ON public.profile_views FOR INSERT WITH CHECK ((auth.uid() IS NULL AND viewer_id IS NULL) OR (auth.uid() IS NOT NULL AND (viewer_id IS NULL OR auth.uid() = viewer_id)));

CREATE OR REPLACE FUNCTION public.update_profile_view_count()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_catalog AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles
    SET view_count = view_count + 1
    WHERE id = NEW.viewed_profile_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles
    SET view_count = GREATEST(0, view_count - 1)
    WHERE id = OLD.viewed_profile_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_profile_view_count ON public.profile_views;
CREATE TRIGGER trg_update_profile_view_count
AFTER INSERT OR DELETE ON public.profile_views
FOR EACH ROW EXECUTE FUNCTION public.update_profile_view_count();

CREATE TABLE IF NOT EXISTS public.job_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  company_name text,
  location text,
  salary_range text,
  job_type text,
  required_skills text[] DEFAULT '{}'::text[],
  posted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  employer_name text,
  employer_avatar text,
  like_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_postings_created_at_idx ON public.job_postings (created_at DESC);

ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public job postings are viewable" ON public.job_postings;
DROP POLICY IF EXISTS "Anyone can insert job postings" ON public.job_postings;

CREATE POLICY "Public job postings are viewable" ON public.job_postings FOR SELECT USING (true);
CREATE POLICY "Anyone can insert job postings" ON public.job_postings FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND (posted_by IS NULL OR auth.uid() = posted_by));

CREATE OR REPLACE FUNCTION public.upsert_device_token(_user_id uuid, _token text, _platform text DEFAULT NULL, _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SET search_path = public, pg_catalog SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.device_tokens(user_id, token, platform, metadata)
  VALUES (_user_id, _token, _platform, _metadata)
  ON CONFLICT (user_id, token)
  DO UPDATE SET updated_at = now(), platform = COALESCE(EXCLUDED.platform, device_tokens.platform), metadata = COALESCE(EXCLUDED.metadata, device_tokens.metadata);
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_notification() RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_catalog AS $$
DECLARE
  payload json;
BEGIN
  payload = json_build_object(
    'id', NEW.id::text,
    'user_id', NEW.user_id::text,
    'actor_id', COALESCE(NEW.actor_id::text, ''),
    'type', NEW.type,
    'title', NEW.title,
    'body', NEW.body,
    'data', COALESCE(NEW.data, '{}'::jsonb)
  );
  PERFORM pg_notify('notifications', payload::text);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_after_insert ON public.notifications;
CREATE TRIGGER notifications_after_insert
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.notify_notification();

CREATE OR REPLACE FUNCTION public.get_profile_counts(p_profile_ids uuid[])
RETURNS TABLE(
  profile_id uuid,
  like_count bigint,
  view_count bigint,
  followers bigint
) LANGUAGE sql STABLE SET search_path = public, pg_catalog AS $$
  SELECT
    p.id,
    p.like_count,
    p.view_count,
    p.followers
  FROM public.profiles p
  WHERE p.id = ANY(p_profile_ids)
  ORDER BY p.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_profile_counts TO service_role;
