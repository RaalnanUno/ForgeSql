
# DBForge — SQLite Edition (LLM First Directive)

## Goal
Recreate the current ForgeSQL Studio concept as a **SQLite-first** desktop app named **DBForge**, built with **Electron + React + TypeScript**, and include **datatype-aware editors** for table data (date picker for dates, input for short strings, textarea for long strings, numeric controls for numbers, checkbox for booleans).

This is a **demo-quality** build: reliable, understandable, and pleasant to use — not production-hard yet.

---

## Non-goals (for v1)
- No server (no Express).
- No multi-user sync.
- No migrations framework required (plain SQL is fine).
- No complex role-based security.
- No full ORM required.

---

## Tech stack and constraints
- Repo root folder name: **reactui/** (NOT ui/)
- UI: **React + TypeScript + Vite + Bootstrap**
- Desktop: **Electron**
- Database: **SQLite** (local file path chosen by user)
- Prefer a simple SQLite library usable in Electron main process (examples: `better-sqlite3` or `sqlite3`). Choose what’s most stable/easiest for Electron.
- **No OCR**, no cloud dependencies.

---

## Required user workflows
1. **Open database**
   - User can open an existing `.db`/`.sqlite` file.
   - If file doesn’t exist, allow “Create new database” at that path.
2. **Object Explorer**
   - Show:
     - Tables
     - Views
   - Click a table/view → auto-load `SELECT * FROM <object> LIMIT 100;`
3. **Query Editor**
   - User can run arbitrary SQL.
4. **Results Grid**
   - Show results in a grid (DataTable-like feel: sticky header, scroll, monospace optional).
5. **Editable Table Mode (datatype-aware)**
   - If results come from a *single table* and the table has a primary key:
     - Allow editing cells with datatype-aware editors:
       - DATE/DATETIME/TIMESTAMP → date or datetime control
       - short TEXT/VARCHAR (<=255) → `<input>`
       - long TEXT / “max” style → `<textarea>`
       - INTEGER/REAL/NUMERIC → numeric editor
       - BOOLEAN (stored as 0/1) → checkbox
     - Save updates back to SQLite with parameterized SQL.
   - If table has **no primary key**, show read-only and explain why (“Editing requires a primary key.”)
6. **Basic CRUD**
   - Must support:
     - Update existing rows (v1)
   - Nice-to-have (not required v1):
     - Insert row
     - Delete row

---

## Architecture (must follow)
### Separation
- **Electron main** owns DB file access and executes SQL.
- **React renderer** never touches SQLite directly — it uses IPC.

### IPC contract
Implement these IPC calls (names can match the ForgeSQL pattern, but SQLite versions):

- `db:open` → open/create database at path
- `db:close`
- `db:listTables`
- `db:listViews`
- `db:describeTable` → returns column metadata (name, type, nullable, pk, default, etc.)
- `db:query` → run SQL and return `{ columns: string[], rows: any[][], rowCount?: number }`
- `db:updateRow` → parameterized UPDATE by PK

Return objects must be shaped like:
```ts
{ ok: true, ...data } | { ok: false, error: string }
````

---

## SQLite metadata requirements

Use SQLite pragmas:

* `PRAGMA table_info(<table>)` (columns, types, nullable, default, pk order)
* `PRAGMA foreign_key_list(<table>)` (optional v1)
* If needed: query `sqlite_master` for tables/views.

The UI must interpret SQLite type affinity:

* INTEGER
* REAL
* TEXT
* BLOB
* NUMERIC
  Plus common declared types like `VARCHAR(50)`, `NVARCHAR`, `DATETIME`, `DATE`, `BOOLEAN`.

---

## Datatype-aware editor rules (v1)

When rendering an editable cell, choose editor based on column’s declared type:

* **Boolean**: `BOOL`, `BOOLEAN`, `BIT` → checkbox (store 0/1)
* **Date**: contains `DATE` but not `DATETIME` → `<input type="date">`
* **DateTime**: contains `DATETIME` or `TIMESTAMP` → `<input type="datetime-local">`
* **Numeric**:

  * INTEGER-ish: contains `INT` → `<input type="number" step="1">`
  * REAL/FLOAT/DOUBLE/DECIMAL/NUMERIC → `<input type="number" step="any">`
* **Text**:

  * If declared length <= 255 → `<input type="text">`
  * Else → `<textarea rows="3..8">`
  * If no length known: default to `<input>` unless value is long (e.g., > 255 chars), then use `<textarea>`
* **Fallback**:

  * BLOB or unknown types → read-only display for v1

---

## UI expectations

* Layout should use the full window (no “half page” bug).
* Left: Object Explorer
* Right top: Query editor
* Right bottom: Results grid
* Footer status bar: show “Ready / Running / Error…”

---

## Deliverables requested from the LLM

1. A proposed folder/file structure matching:

   * `electron/main/*`
   * `electron/preload/*`
   * `electron/shared/types.ts`
   * `reactui/src/*`
2. The exact TypeScript interfaces for the IPC responses and metadata types.
3. The SQLite implementation in Electron main:

   * open/close
   * query
   * list tables/views
   * describe table
   * update row (PK-based)
4. The React UI wiring:

   * object explorer loads tables/views
   * clicking an item runs `SELECT * FROM ... LIMIT 100`
   * results grid renders columns/rows
   * editable mode for tables with PK
5. A datatype-aware cell editor system:

   * small set of React components (TextEditor, TextAreaEditor, DateEditor, DateTimeEditor, NumberEditor, BoolEditor)
   * inline editing behavior (enter to save, esc to cancel, blur optional)
   * row-level dirty tracking is fine; full undo not required

---

## Acceptance criteria (definition of done)

* I can open or create a SQLite database file.
* I can see tables/views in the explorer.
* I can run SQL queries and see results.
* I can click a table → see the first 100 rows.
* If the table has a PK, I can edit supported columns and click Save (or commit via enter), and the data persists.
* If the table has no PK, editing is disabled with a clear message.

---

## Style of response expected from the LLM

* Be **file-specific**: always say *which file* and *where to paste*.
* Keep it incremental: “Step 1, Step 2…”
* Prefer correctness + clarity over cleverness.

Project name: **DBForge**
Database target: **SQLite**
Frontend folder: **reactui/**
Language: **TypeScript**
