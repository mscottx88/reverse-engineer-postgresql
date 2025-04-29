DROP SCHEMA IF EXISTS source CASCADE;

CREATE SCHEMA source;

SET check_function_bodies = false;

SET search_path = source;

CREATE FUNCTION test_table_trigger ()
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
  'cron',
  'manual',
  'ad-hoc',
  'event'
);

CREATE TABLE test_table (
  id BIGSERIAL NOT NULL,
  report_owner TEXT NOT NULL,
  report_date DATE NOT NULL,
  report_data TEXT NOT NULL,
  report_parsed JSONB,
  report_type test_report_type NOT NULL,
  report_tsvector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', report_data)) STORED
)
PARTITION BY LIST (report_date);

CREATE TABLE test_table_20250422 PARTITION OF test_table (
  CHECK (report_date = '2025-04-22'::date)
)
FOR VALUES IN ('2025-04-22');

CREATE INDEX ON test_table USING BTREE (report_owner);

CREATE INDEX ON test_table USING GIN (report_parsed);

CREATE INDEX ON test_table USING GIN (report_tsvector);

ALTER TABLE test_table ADD PRIMARY KEY (id, report_date);

CREATE TRIGGER test_table_trigger
  AFTER INSERT OR DELETE OR UPDATE
  ON test_table
  FOR EACH ROW
  EXECUTE FUNCTION test_table_trigger ();

CREATE VIEW test_table_classic_view
AS
SELECT *
FROM test_table
WHERE report_type = 'classic'::test_report_type;
