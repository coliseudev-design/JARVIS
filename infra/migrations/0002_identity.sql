-- Auth is a privileged identity component, with no SELECT on personal content.
CREATE SCHEMA jarvis_auth AUTHORIZATION jarvis_owner;
REVOKE ALL ON SCHEMA jarvis_auth FROM PUBLIC;
GRANT USAGE ON SCHEMA jarvis_auth TO jarvis_auth;
GRANT USAGE ON SCHEMA jarvis TO jarvis_auth;
GRANT SELECT ON jarvis.schema_migrations TO jarvis_auth;

CREATE TABLE jarvis_auth.users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  platform_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE jarvis_auth.tenants (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120)
);
CREATE TABLE jarvis_auth.memberships (
  tenant_id uuid NOT NULL REFERENCES jarvis_auth.tenants(id),
  user_id uuid NOT NULL REFERENCES jarvis_auth.users(id),
  role text NOT NULL CHECK (role IN ('member','tenant_admin')),
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (tenant_id, user_id)
);
CREATE TABLE jarvis_auth.invitations (
  id uuid PRIMARY KEY,
  token_hash char(64) NOT NULL UNIQUE,
  tenant_id uuid NOT NULL REFERENCES jarvis_auth.tenants(id),
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('member','tenant_admin')),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE jarvis_auth.sessions (
  id uuid PRIMARY KEY,
  token_hash char(64) NOT NULL UNIQUE,
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  mfa_verified boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id,user_id) REFERENCES jarvis_auth.memberships(tenant_id,user_id)
);
CREATE INDEX sessions_owner ON jarvis_auth.sessions(user_id,tenant_id);
CREATE TABLE jarvis_auth.recovery_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES jarvis_auth.users(id),
  token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);
CREATE TABLE jarvis_auth.mfa_factors (
  user_id uuid PRIMARY KEY REFERENCES jarvis_auth.users(id),
  active_ciphertext text,
  pending_ciphertext text,
  pending_expires_at timestamptz,
  last_counter bigint NOT NULL DEFAULT -1
);
CREATE TABLE jarvis_auth.rate_limits (
  key_hash char(64) PRIMARY KEY,
  attempts integer NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX rate_limits_expiry ON jarvis_auth.rate_limits(expires_at);
CREATE TABLE jarvis_auth.audit_events (
  id uuid PRIMARY KEY,
  actor_user_id uuid,
  tenant_id uuid,
  operation text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA jarvis_auth TO jarvis_auth;
REVOKE UPDATE,DELETE ON jarvis_auth.audit_events FROM jarvis_auth;

CREATE TABLE jarvis.user_profiles (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  owner_user_id uuid NOT NULL,
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 120),
  timezone text NOT NULL DEFAULT 'America/Cuiaba',
  version integer NOT NULL DEFAULT 1,
  UNIQUE(tenant_id, owner_user_id),
  UNIQUE(tenant_id, owner_user_id, id),
  FOREIGN KEY (tenant_id, owner_user_id) REFERENCES jarvis_auth.memberships(tenant_id,user_id)
);
ALTER TABLE jarvis.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE jarvis.user_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY profile_read ON jarvis.user_profiles FOR SELECT TO jarvis_api
  USING (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid
    AND owner_user_id = NULLIF(current_setting('app.user_id',true),'')::uuid);
CREATE POLICY profile_update ON jarvis.user_profiles FOR UPDATE TO jarvis_api
  USING (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid
    AND owner_user_id = NULLIF(current_setting('app.user_id',true),'')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid
    AND owner_user_id = NULLIF(current_setting('app.user_id',true),'')::uuid);
CREATE POLICY profile_create ON jarvis.user_profiles FOR INSERT TO jarvis_auth
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid
    AND owner_user_id = NULLIF(current_setting('app.user_id',true),'')::uuid);
GRANT SELECT ON jarvis.user_profiles TO jarvis_api;
GRANT UPDATE(display_name,timezone,version) ON jarvis.user_profiles TO jarvis_api;
GRANT INSERT ON jarvis.user_profiles TO jarvis_auth;
