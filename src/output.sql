SET check_function_bodies = FALSE;

SET search_path = test_0000000004;

CREATE OR REPLACE FUNCTION test_0000000004.reports_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

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

    $function$
;

CREATE TYPE test_report_type AS ENUM (
  'classic',
  'manual'
);

CREATE SEQUENCE IF NOT EXISTS test_0000000004.reports_id_seq;

CREATE TABLE IF NOT EXISTS reports (
  "id" bigint not null DEFAULT nextval('test_0000000004.reports_id_seq'::regclass),
  "report_owner" text not null,
  "report_date" date not null,
  "report_data" text not null,
  "report_parsed" jsonb,
  "report_type" test_0000000004.test_report_type not null,
  "report_tsvector" tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig, report_data)) STORED
)
 PARTITION BY LIST (report_type);

CREATE TABLE test_0000000004.reports_classic PARTITION OF test_0000000004.reports (
  CONSTRAINT reports_classic_report_type_check CHECK ((report_type = 'classic'::test_0000000004.test_report_type))
)
FOR VALUES IN ('classic');

CREATE TABLE test_0000000004.reports_manual PARTITION OF test_0000000004.reports (
  CONSTRAINT reports_manual_report_type_check CHECK ((report_type = 'manual'::test_0000000004.test_report_type))
)
FOR VALUES IN ('manual');

CREATE INDEX reports_classic_report_owner_idx ON test_0000000004.reports_classic USING btree (report_owner);

CREATE INDEX reports_classic_report_parsed_idx ON test_0000000004.reports_classic USING gin (report_parsed);

CREATE INDEX reports_classic_report_tsvector_idx ON test_0000000004.reports_classic USING gin (report_tsvector);

CREATE INDEX reports_manual_report_owner_idx ON test_0000000004.reports_manual USING btree (report_owner);

CREATE INDEX reports_manual_report_parsed_idx ON test_0000000004.reports_manual USING gin (report_parsed);

CREATE INDEX reports_manual_report_tsvector_idx ON test_0000000004.reports_manual USING gin (report_tsvector);

CREATE INDEX reports_report_owner_idx ON ONLY test_0000000004.reports USING btree (report_owner);

CREATE INDEX reports_report_parsed_idx ON ONLY test_0000000004.reports USING gin (report_parsed);

CREATE INDEX reports_report_tsvector_idx ON ONLY test_0000000004.reports USING gin (report_tsvector);

ALTER TABLE reports
  ADD CONSTRAINT reports_pkey
  PRIMARY KEY (id, report_type);

CREATE TRIGGER reports_trigger AFTER INSERT OR DELETE OR UPDATE ON test_0000000004.reports FOR EACH ROW EXECUTE FUNCTION test_0000000004.reports_trigger();

CREATE OR REPLACE VIEW reports_classic_view AS
 SELECT reports.id,
    reports.report_owner,
    reports.report_date,
    reports.report_data,
    reports.report_parsed,
    reports.report_type,
    reports.report_tsvector
   FROM test_0000000004.reports
  WHERE (reports.report_type = 'classic'::test_0000000004.test_report_type);
