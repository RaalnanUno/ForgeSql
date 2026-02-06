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