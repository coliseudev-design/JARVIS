-- Operational synthetic probes only. Personal data tables and RLS enter F02.
REVOKE ALL ON SCHEMA jarvis FROM PUBLIC;
GRANT USAGE ON SCHEMA jarvis TO jarvis_api, jarvis_worker;
GRANT SELECT ON jarvis.schema_migrations TO jarvis_api, jarvis_worker;
CREATE TABLE jarvis.foundation_checks (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind = 'synthetic_probe'),
  completed_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON jarvis.foundation_checks FROM PUBLIC;
GRANT SELECT ON jarvis.foundation_checks TO jarvis_api;
GRANT INSERT, SELECT ON jarvis.foundation_checks TO jarvis_worker;
