## Product

Inertia is an app for documents, spreadsheets, and tasks.

### Documents
Documents have common formatting much like Quip or Google Docs.

#### Document Templates
Documents can have templates such as Product Requirements Documents, etc.

### Spreadsheets
Excel-like spreadsheets with formulas.

### Collections
A collection document is one similar to a database table, where a name is set and fields are set. Each field has a type. The type has validations set with it. Users see these as **Collections** (never "Tables"); code, API and DB keep `table` (`doc_type: table`, `TableField`, `TableCell`).

### Tasks
Tasks can be rolled up from whats inside documents. Tasks are created in documents by just creating a checklist or a checkable item. Epics can be created from the paragraph headings that tasks are inside of. For example, if I am working on a feature for a tool called Messages. In a Messages document, I might have a paragraph about a feature called "Background images", and a checkbox for the tasks to complete that feature. This makes each checkbox a task automatically.

### Spaces (code: workspaces)
Users see workspaces as **Spaces**. Use "Space" in every label, message, page title and doc meant for users. Code, API paths, the `X-Workspace-Id` header and the database keep the name `workspace`. Rails model names are translated in `backend/config/locales/en.yml`. See `docs/spaces.md`.

### Products (code: projects)
Users see projects as **Products** (Alex, 2026-11-20). Use "Product" in every label, message, page title and doc meant for users. Code, API paths, the `X-Project-Id` header and the database keep `project` (a folder with `kind: project`), like Spaces keep `workspace`; Rails attribute names are translated in `backend/config/locales/en.yml`. Inside a Space are Products, and they are the Space's home page (`/space`). Each has its own documents, files, collections, events and tasks, and every document belongs to one (see `docs/features/projects.md` and `docs/features/documents_in_products.md`).

### Design principles

Alex's design principles (2026-10-22) are now the shared rule [design-principles.md](../rules/design-principles.md). They apply to every page, feature and backlog task.
