import sql from './utils.js';

export const PAGE_SIZE = 100 as const;

export function listEnums(schema: string, offset: number = 0): string {
  return sql`
    SELECT
      FORMAT(
        E'CREATE TYPE %s AS ENUM (\\n%s\\n)',
        TYP.typname,
        ARRAY_TO_STRING(
          ARRAY_AGG(
            FORMAT('  %L', ENM.enumlabel)
            ORDER BY ENM.enumsortorder
          ),
          E',\\n'
        )
      ) AS statement
    FROM pg_catalog.pg_enum ENM
    INNER JOIN pg_type TYP ON TYP.oid = ENM.enumtypid
    WHERE to_regnamespace(:${schema}) = TYP.typnamespace
    GROUP BY typname
    ORDER BY statement
    LIMIT :${PAGE_SIZE}
    OFFSET :${offset}
  `;
}

export function listFunctions(schema: string, offset: number = 0): string {
  return sql`
    SELECT pg_get_functiondef(PRC.oid) AS statement
    FROM pg_proc PRC
    WHERE to_regnamespace(:${schema}) = PRC.pronamespace
    ORDER BY statement
    LIMIT :${PAGE_SIZE}
    OFFSET :${offset}
  `;
}

export const listTableConstraints = (
  schema: string,
  table?: string,
  offset: number = 0,
): string => {
  return sql`
    SELECT
      FORMAT(
        E'ALTER TABLE %I\\n  ADD CONSTRAINT %I\\n  %s',
        CLS.relname,
        CON.conname,
        pg_get_constraintdef(CON.oid)
      ) AS statement
    FROM pg_constraint CON
    INNER JOIN pg_class CLS ON CLS.oid = CON.conrelid
    WHERE (
      to_regnamespace(:${schema}) = CON.connamespace
      AND CLS.relname = COALESCE(:${table}, CLS.relname)
    )
    AND NOT EXISTS (
      SELECT
      FROM pg_inherits INH
      WHERE INH.inhrelid = CLS.oid
    )
    ORDER BY
      CASE CON.contype
        WHEN 'c' THEN 1
        WHEN 'p' THEN 2
        WHEN 'u' THEN 3
        WHEN 'f' THEN 4
      END,
      CON.conname
    LIMIT :${PAGE_SIZE}
    OFFSET :${offset}
  `;
};

export function listTableIndexes(schema: string, table?: string, offset: number = 0): string {
  return sql`
    SELECT IDX.indexdef AS statement
    FROM pg_indexes IDX
    WHERE (
      IDX.schemaname = :${schema}
      AND IDX.tablename = COALESCE(:${table}, IDX.tablename)
      AND NOT EXISTS (
        SELECT
        FROM pg_constraint CON
        WHERE (
          to_regnamespace(:${schema}) = CON.connamespace
          AND CON.conname = IDX.indexname
        )
      )
    )
    ORDER BY statement
    LIMIT :${PAGE_SIZE}
    OFFSET :${offset}
  `;
}

export function listTablePartitions(schema: string, table?: string, offset: number = 0): string {
  return sql`
    SELECT
      FORMAT(
        E'CREATE TABLE %I.%I PARTITION OF %I.%I (\\n  CONSTRAINT %I %s\\n)\\n%s',
        CN.nspname,
        CHL.relname,
        PN.nspname,
        PRN.relname,
        conname,
        pg_get_constraintdef(CON.oid),
        pg_get_expr(CHL.relpartbound, CHL.oid)
      ) AS statement
    FROM pg_inherits INH
    INNER JOIN pg_class PRN ON INH.inhparent = PRN.oid
    INNER JOIN pg_class CHL ON INH.inhrelid = CHL.oid
    INNER JOIN pg_namespace PN ON PN.oid = PRN.relnamespace
    INNER JOIN pg_namespace CN ON CN.oid = CHL.relnamespace
    INNER JOIN pg_constraint CON ON CON.conrelid = CHL.oid
    WHERE (
      PN.nspname = :${schema}
      AND PRN.relname = COALESCE(:${table}, PRN.relname)
      AND CON.contype = 'c'
    )
    ORDER BY statement
    LIMIT :${PAGE_SIZE}
    OFFSET :${offset}
  `;
}

export function listTableSequences(schema: string, table?: string, offset: number = 0): string {
  return sql`
    SELECT
      FORMAT(
        'CREATE SEQUENCE IF NOT EXISTS %s',
        pg_get_serial_sequence(NSP.nspname || '.' || REF.relname, ATT.attname)
      ) AS statement
    FROM pg_depend DEP
    INNER JOIN pg_class CLS ON CLS.oid = DEP.objid
    INNER JOIN pg_class REF ON REF.oid = DEP.refobjid
    INNER JOIN pg_namespace NSP ON NSP.oid = REF.relnamespace
    INNER JOIN pg_attribute ATT ON (
      ATT.attrelid = REF.oid
      AND ATT.attnum = DEP.refobjsubid
    )
    WHERE NSP.nspname = :${schema}
    AND REF.relname = COALESCE(:${table}, REF.relname)
    AND CLS.relkind = 'S'
    ORDER BY statement
    LIMIT :${PAGE_SIZE}
    OFFSET :${offset}
  `;
}

export const listTables = (schema: string, table?: string, offset: number = 0): string => {
  return sql`
    SELECT
      FORMAT(
        E'CREATE TABLE IF NOT EXISTS %s (\\n%s\\n)%s',
        table_name,
        ARRAY_TO_STRING(
          ARRAY_AGG(
            FORMAT(
              '  "%s" %s%s%s',
              column_name,
              type,
              nullable,
              CASE
                WHEN is_generated THEN
                  ' GENERATED ALWAYS AS (' || default_value || ') STORED'
                ELSE ' DEFAULT ' || default_value
              END
            )
            ORDER BY column_index
          ),
          E',\\n'
        ),
        CASE WHEN partition_spec IS NOT NULL THEN FORMAT(E'\\n PARTITION BY %s', partition_spec) END
      ) AS statement
    FROM (
      SELECT
        CLS.relname AS table_name,
        ATT.attname AS column_name,
        ATT.attnum AS column_index,
        LOWER(FORMAT_TYPE(ATT.atttypid, ATT.atttypmod)) AS type,
        CASE WHEN ATT.attnotnull THEN ' not null' ELSE '' END AS nullable,
        TRIM(ATT.attgenerated) <> '' AS is_generated,
        pg_get_expr(DEF.adbin, DEF.adrelid) AS default_value,
        pg_get_partkeydef(PRT.partrelid) AS partition_spec
      FROM pg_class CLS
      LEFT OUTER JOIN pg_partitioned_table PRT ON PRT.partrelid = CLS.oid
      INNER JOIN pg_attribute ATT ON ATT.attrelid = CLS.oid
      LEFT OUTER JOIN pg_attrdef DEF ON (
        DEF.adrelid = CLS.oid
        AND DEF.adnum = ATT.attnum
      )
      INNER JOIN pg_type t ON ATT.atttypid = t.oid
      WHERE (
        to_regnamespace(:${schema}) = CLS.relnamespace
        AND CLS.relkind IN ('r', 'p')
        AND ATT.attnum > 0
      )
      AND NOT EXISTS (
        SELECT
        FROM pg_inherits INH
        WHERE INH.inhrelid = CLS.oid
      )
    ) AS table_definition
    WHERE table_name = COALESCE(:${table}, table_name)
    GROUP BY table_name, partition_spec
    ORDER BY statement
    LIMIT :${PAGE_SIZE}
    OFFSET :${offset}
  `;
};

export function listTriggers(schema: string, offset: number = 0): string {
  return sql`
    SELECT pg_get_triggerdef(TRG.oid) AS statement
    FROM pg_trigger TRG
    INNER JOIN pg_class CLS ON CLS.oid = TRG.tgrelid
    WHERE (
      to_regnamespace(:${schema}) = CLS.relnamespace
      AND NOT TRG.tgisinternal
    )
    ORDER BY statement
    LIMIT :${PAGE_SIZE}
    OFFSET :${offset}
  `;
}

export function listViews(schema: string, offset: number = 0): string {
  return sql`
    SELECT
      FORMAT(
        E'CREATE OR REPLACE VIEW %I AS\\n%s',
        relname,
        TRIM(TRAILING ';' FROM pg_get_viewdef(CLS.oid))
      ) AS statement
    FROM pg_class CLS
    WHERE (
      to_regnamespace(:${schema}) = CLS.relnamespace
      AND CLS.relkind = 'v'
    )
    ORDER BY statement
    LIMIT :${PAGE_SIZE}
    OFFSET :${offset}
  `;
}
