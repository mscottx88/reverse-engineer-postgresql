SET check_function_bodies = false;

SET search_path = source;

CREATE FUNCTION reports_trigger ()
  RETURNS trigger
  LANGUAGE plpgsql
    AS $BODY$

      DECLARE before_change JSONB;
      DECLARE after_change JSONB;

      BEGIN

        CASE TG_OP
          WHEN 'INSERT' THEN
            after_change = TO_JSONB(NEW);
          WHEN 'DELETE' THEN
            before_change = TO_JSONB(OLD);
          WHEN 'UPDATE' THEN
            before_change = TO_JSONB(OLD);
            after_change = TO_JSONB(NEW);
        END CASE;

        RAISE NOTICE 'Before: %s After: %s', before_change, after_change;

        -- presumably do some kind of audit logging...

        RETURN NULL;

      END;

    $BODY$;

CREATE TYPE test_report_type AS ENUM (
  'classic',
  'manual'
);

CREATE TABLE reports (
  id BIGSERIAL NOT NULL,
  report_owner TEXT NOT NULL,
  report_date DATE NOT NULL,
  report_data TEXT NOT NULL,
  report_parsed JSONB,
  report_type test_report_type NOT NULL,
  report_tsvector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', report_data)) STORED
)
PARTITION BY LIST (report_type);

CREATE TABLE reports_classic PARTITION OF reports (
  CHECK (report_type = 'classic'::test_report_type)
)
FOR VALUES IN ('classic'::test_report_type);

CREATE TABLE reports_manual PARTITION OF reports (
  CHECK (report_type = 'manual'::test_report_type)
)
FOR VALUES IN ('manual'::test_report_type);

CREATE INDEX ON reports USING BTREE (report_owner);

CREATE INDEX ON reports USING GIN (report_parsed);

CREATE INDEX ON reports USING GIN (report_tsvector);

ALTER TABLE reports ADD PRIMARY KEY (id, report_type);

CREATE TRIGGER reports_trigger
  AFTER INSERT OR DELETE OR UPDATE
  ON reports
  FOR EACH ROW
  EXECUTE FUNCTION reports_trigger ();

CREATE VIEW reports_classic_view
AS
SELECT *
FROM reports
WHERE report_type = 'classic'::test_report_type;
