
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create tip status enum
CREATE TYPE public.tip_status AS ENUM ('pending', 'won', 'lost', 'void');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles table (separate from profiles per security requirements)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Tips table
CREATE TABLE public.tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  match_name TEXT NOT NULL,
  sport TEXT NOT NULL,
  bet_type TEXT NOT NULL,
  odds DECIMAL(10,2) NOT NULL,
  status tip_status NOT NULL DEFAULT 'pending',
  analysis TEXT,
  match_start_time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tips ENABLE ROW LEVEL SECURITY;

-- User tracking table
CREATE TABLE public.user_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tip_id UUID NOT NULL REFERENCES public.tips(id) ON DELETE CASCADE,
  stake DECIMAL(10,2) NOT NULL CHECK (stake > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tip_id)
);
ALTER TABLE public.user_tracking ENABLE ROW LEVEL SECURITY;

-- Tip reactions table
CREATE TABLE public.tip_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tip_id UUID NOT NULL REFERENCES public.tips(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL DEFAULT 'like',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tip_id, reaction_type)
);
ALTER TABLE public.tip_reactions ENABLE ROW LEVEL SECURITY;

-- Tip comments table
CREATE TABLE public.tip_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tip_id UUID NOT NULL REFERENCES public.tips(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tip_comments ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_tips_updated_at
BEFORE UPDATE ON public.tips
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Anti-cheat trigger: prevent editing bet_type/odds after match_start_time
CREATE OR REPLACE FUNCTION public.enforce_tip_anti_cheat()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.match_start_time <= now() THEN
    -- After match start, only allow status changes
    IF NEW.bet_type IS DISTINCT FROM OLD.bet_type
      OR NEW.odds IS DISTINCT FROM OLD.odds
      OR NEW.match_name IS DISTINCT FROM OLD.match_name
    THEN
      RAISE EXCEPTION 'Cannot edit tip details after match has started. Only status can be updated.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tip_anti_cheat
BEFORE UPDATE ON public.tips
FOR EACH ROW EXECUTE FUNCTION public.enforce_tip_anti_cheat();

-- RLS Policies

-- Profiles: everyone can read, users update own
CREATE POLICY "Anyone can read profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- User roles: only readable by admins/moderators, managed by admins only
CREATE POLICY "Roles readable by authenticated" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins manage roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Tips: everyone can read, moderators/admins can insert/update/delete
CREATE POLICY "Anyone can read tips" ON public.tips FOR SELECT USING (true);
CREATE POLICY "Moderators can create tips" ON public.tips FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Moderators can update tips" ON public.tips FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Moderators can delete tips" ON public.tips FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin'));

-- User tracking: users can insert/read own, moderators can read all
CREATE POLICY "Users read own tracking" ON public.user_tracking FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own tracking" ON public.user_tracking FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own tracking" ON public.user_tracking FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Tip reactions: anyone can read, authenticated users can insert/delete own
CREATE POLICY "Anyone can read reactions" ON public.tip_reactions FOR SELECT USING (true);
CREATE POLICY "Users insert own reactions" ON public.tip_reactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own reactions" ON public.tip_reactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Tip comments: anyone can read, authenticated users can insert own
CREATE POLICY "Anyone can read comments" ON public.tip_comments FOR SELECT USING (true);
CREATE POLICY "Users insert own comments" ON public.tip_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own comments" ON public.tip_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Enable realtime for tips
ALTER PUBLICATION supabase_realtime ADD TABLE public.tips;
