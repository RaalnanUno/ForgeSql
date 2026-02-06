OK, this works.
I'd like to make some changes to the UI.
We might want to use BootStrap cards or something. When I select a table that has a lot of data, the table and view navigation on the left gets smashed.
Also, we want to make use of some sort of table editor like DataTables.

The editor fields need to be datatype aware.

- dates get a date picker
- numbers get a number element
- large text gets a textArea
- etc...

## package.md

![[package.md]]

## electron/main/index.ts

![[electron/main/index.md]]

## electron/main/db/queries.ts
.
![[electron/main/db/queries.md]]
.
## electron/main/db/sqlserver.ts
.
![[electron/main/db/sqlserver.md]]
.
## reactui/src/App.ts

![[reactui/src/App.md]]

## reactui/src/main.ts

![[reactui/src/main.md]]

## reactui/src/api/dbforge.ts
.
![[reactui/src/api/dbforge.md]]
.
## reactui/src/components/ConnectionDialog.ts
.
![[reactui/src/components/ConnectionDialog.md]]
.
## reactui/src/components/ObjectExplorer.ts
.
![[reactui/src/components/ObjectExplorer.md]]
.
## reactui/src/components/QueryEditor.ts
.
![[reactui/src/components/QueryEditor.md]]
.
## reactui/src/components/ResultsGrid.ts
.
![[reactui/src/components/ResultsGrid.md]]
.
