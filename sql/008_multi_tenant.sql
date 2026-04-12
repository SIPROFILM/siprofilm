-- =============================================
-- 008: Multi-tenant architecture
-- Adds organizations, user-org mapping, and
-- links programs to organizations.
-- =============================================

-- 1. Organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. User ↔ Organization relationship
CREATE TABLE IF NOT EXISTS public.user_organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, org_id)
);

-- 3. Add org_id to programs
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id);

-- Index for fast org-based queries
CREATE INDEX IF NOT EXISTS idx_programs_org_id ON public.programs(org_id);
CREATE INDEX IF NOT EXISTS idx_user_organizations_user_id ON public.user_organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_organizations_org_id ON public.user_organizations(org_id);

-- 4. Enable RLS on new tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_organizations ENABLE ROW LEVEL SECURITY;

-- 5. RLS for organizations: users can see orgs they belong to
CREATE POLICY "users_see_own_orgs"
  ON public.organizations FOR SELECT
  USING (
    id IN (
      SELECT org_id FROM public.user_organizations
      WHERE user_id = auth.uid()
    )
  );

-- Admins can update their org
CREATE POLICY "admins_update_own_org"
  ON public.organizations FOR UPDATE
  USING (
    id IN (
      SELECT org_id FROM public.user_organizations
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 6. RLS for user_organizations: users see their own memberships
CREATE POLICY "users_see_own_memberships"
  ON public.user_organizations FOR SELECT
  USING (user_id = auth.uid());

-- Admins can manage memberships in their org
CREATE POLICY "admins_manage_memberships"
  ON public.user_organizations FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM public.user_organizations
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 7. Update programs RLS: replace open policy with org-based
-- First drop the old open policy
DROP POLICY IF EXISTS "auth_full_access" ON public.programs;

-- Users can see programs from their orgs
CREATE POLICY "users_see_org_programs"
  ON public.programs FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.user_organizations
      WHERE user_id = auth.uid()
    )
    OR org_id IS NULL  -- legacy programs without org still visible
  );

-- Members and admins can insert programs in their org
CREATE POLICY "users_insert_org_programs"
  ON public.programs FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.user_organizations
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
    OR org_id IS NULL
  );

-- Members and admins can update programs in their org
CREATE POLICY "users_update_org_programs"
  ON public.programs FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM public.user_organizations
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
    OR org_id IS NULL
  );

-- Only admins can delete programs
CREATE POLICY "admins_delete_org_programs"
  ON public.programs FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM public.user_organizations
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 8. Seed the 4 initial organizations
INSERT INTO public.organizations (name, slug) VALUES
  ('Matchpoint Films', 'matchpoint'),
  ('AMATEUR Films', 'amateur'),
  ('Scopio', 'scopio'),
  ('Casa Gori', 'casagori')
ON CONFLICT (slug) DO NOTHING;
