-- ── Organizations ────────────────────────────────────────────────────────────
CREATE TABLE public.organizations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  created_by  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  max_coaches INTEGER     NOT NULL DEFAULT 5,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- ── Organization members ──────────────────────────────────────────────────────
CREATE TABLE public.org_members (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id    UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id   UUID        NOT NULL REFERENCES public.profiles(id)      ON DELETE CASCADE,
  role      TEXT        NOT NULL DEFAULT 'coach' CHECK (role IN ('admin', 'coach')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- ── Coach invitations (pending) ───────────────────────────────────────────────
CREATE TABLE public.org_invitations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  role        TEXT        NOT NULL DEFAULT 'coach',
  invited_by  UUID        NOT NULL REFERENCES public.profiles(id),
  token       UUID        NOT NULL DEFAULT gen_random_uuid(),
  status      TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.org_invitations ENABLE ROW LEVEL SECURITY;

-- ── Shared documents ─────────────────────────────────────────────────────────
CREATE TABLE public.org_documents (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  description     TEXT,
  file_path       TEXT        NOT NULL,
  file_size_bytes BIGINT,
  file_type       TEXT,
  uploaded_by     UUID        NOT NULL REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.org_documents ENABLE ROW LEVEL SECURITY;

-- ── Helper: is current user a member of given org? ───────────────────────────
CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id UUID)
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = p_org_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id UUID)
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = p_org_id AND user_id = auth.uid() AND role = 'admin'
  );
$$;

-- ── RLS policies ──────────────────────────────────────────────────────────────

-- Organizations: visible to members; created by anyone (becomes admin automatically)
CREATE POLICY "org_members_select_org"
  ON public.organizations FOR SELECT
  USING (public.is_org_member(id));

CREATE POLICY "org_creator_insert"
  ON public.organizations FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "org_admin_update"
  ON public.organizations FOR UPDATE
  USING (public.is_org_admin(id));

-- Org members: members can view; only admins can manage
CREATE POLICY "org_members_select"
  ON public.org_members FOR SELECT
  USING (public.is_org_member(org_id));

CREATE POLICY "org_admin_manage_members"
  ON public.org_members FOR ALL
  USING (public.is_org_admin(org_id))
  WITH CHECK (public.is_org_admin(org_id));

-- Special: allow inserting yourself as admin when creating a new org
CREATE POLICY "self_insert_member"
  ON public.org_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Invitations: org members can view; admins can create/update
CREATE POLICY "org_members_view_invitations"
  ON public.org_invitations FOR SELECT
  USING (public.is_org_member(org_id));

CREATE POLICY "org_admin_manage_invitations"
  ON public.org_invitations FOR ALL
  USING (public.is_org_admin(org_id))
  WITH CHECK (public.is_org_admin(org_id));

-- Documents: all members can view; admins can upload/delete
CREATE POLICY "org_members_view_docs"
  ON public.org_documents FOR SELECT
  USING (public.is_org_member(org_id));

CREATE POLICY "org_admin_manage_docs"
  ON public.org_documents FOR ALL
  USING (public.is_org_admin(org_id))
  WITH CHECK (public.is_org_admin(org_id));

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX idx_org_members_org    ON public.org_members(org_id);
CREATE INDEX idx_org_members_user   ON public.org_members(user_id);
CREATE INDEX idx_org_invitations    ON public.org_invitations(org_id, status);
CREATE INDEX idx_org_documents      ON public.org_documents(org_id);

-- ── Storage bucket for org documents ─────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('org-documents', 'org-documents', true, 104857600)  -- 100 MB
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 104857600;

-- Any authenticated member of the org can read (public bucket, paths are org-scoped)
-- Admins write: path must start with their org's UUID
