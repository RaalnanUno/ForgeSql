// File: electron/main/db/queries.ts

export function describeTableSql(_schema: string, _table: string) {
  return `
SELECT
  c.COLUMN_NAME AS [name],
  c.DATA_TYPE AS [dataType],
  CASE WHEN c.IS_NULLABLE = 'YES' THEN 1 ELSE 0 END AS [isNullable],
  CASE WHEN c.CHARACTER_MAXIMUM_LENGTH IS NULL THEN NULL ELSE c.CHARACTER_MAXIMUM_LENGTH END AS [maxLength],
  CASE WHEN c.NUMERIC_PRECISION IS NULL THEN NULL ELSE c.NUMERIC_PRECISION END AS [numericPrecision],
  CASE WHEN c.NUMERIC_SCALE IS NULL THEN NULL ELSE c.NUMERIC_SCALE END AS [numericScale],
  CASE WHEN ic.column_id IS NULL THEN 0 ELSE 1 END AS [isIdentity]
FROM INFORMATION_SCHEMA.COLUMNS c
LEFT JOIN sys.tables t ON t.name = c.TABLE_NAME
LEFT JOIN sys.schemas s ON s.schema_id = t.schema_id AND s.name = c.TABLE_SCHEMA
LEFT JOIN sys.columns sc ON sc.object_id = t.object_id AND sc.name = c.COLUMN_NAME
LEFT JOIN sys.identity_columns ic ON ic.object_id = t.object_id AND ic.column_id = sc.column_id
WHERE c.TABLE_SCHEMA = @schema AND c.TABLE_NAME = @table
ORDER BY c.ORDINAL_POSITION;
`.trim();
}

export function primaryKeySql(_schema: string, _table: string) {
  return `
SELECT kcu.COLUMN_NAME AS [name]
FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
  ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
  AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
  AND tc.TABLE_NAME = kcu.TABLE_NAME
WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
  AND tc.TABLE_SCHEMA = @schema
  AND tc.TABLE_NAME = @table
ORDER BY kcu.ORDINAL_POSITION;
`.trim();
}

export const listDatabasesSql = `
SELECT name
FROM sys.databases
WHERE database_id > 4
ORDER BY name;
`;

export const listTablesSql = `
SELECT s.name + '.' + t.name AS [name]
FROM sys.tables t
JOIN sys.schemas s ON t.schema_id = s.schema_id
ORDER BY s.name, t.name;
`;

export const listViewsSql = `
SELECT s.name + '.' + v.name AS [name]
FROM sys.views v
JOIN sys.schemas s ON v.schema_id = s.schema_id
ORDER BY s.name, v.name;
`;

export function selectTopSql(fullName: string, top = 100) {
  return `SELECT TOP (${top}) * FROM ${fullName};`;
}