# Every document is in a product

Alex (2026-11-20): all documents, task documents included, belong to a project ("product" in the UI; code and API keep `project`, a folder with `kind: project`). A document's folder has to be the project itself or a folder anywhere inside it.

## Rules

- **Documents** (`Document#folder_in_a_project`): a document of any type (document, sheet, Collection, uploaded file) can only be made in, or moved to, a folder inside a project. Otherwise the API answers 422 with `Folder must be in a product`. A document that is somewhere else (older data) can still be edited where it is.
- **Folders** (`Folder#documents_stay_in_a_project`): a folder holding documents, at any depth, can't move out of every project, and a project holding documents can't be made a plain folder. Empty folders move freely.
- `Folder#project` gives the project a folder is in (itself, or the nearest one above), or nil.
- **Moving or copying to another Space** (`SpaceTransfer`): documents only go into a project or a folder inside one (`Documents must be in a product...`); a project, or a folder with no documents, can go anywhere. The Move/Copy dialog offers only folders inside products for a document.
- **Import from Quip**: with no destination inside a project, the import gets a new project called "Quip import".
- **New documents** with no project open go to the Space's **Personal Product** (an older "Personal Project" is reused), created when missing (`hooks/useNewDocument.ts`). Dropped files ask which product to use (see [uploaded_files.md](uploaded_files.md)).

## Existing documents

The migration `MoveLooseDocumentsIntoProjects` (Alex chose this on 2026-11-20) runs `LooseDocuments.adopt_all!`: in every Space, documents outside every project go into the Personal Product (an existing "Personal Product" or "Personal Project", else a new "Personal Product"). A plain top-level folder holding them moves there whole, keeping its structure, unless a project sits inside it; then only its loose documents move. Old paths keep redirecting (path aliases). A record that won't save is logged and left where it is. Nothing is deleted, and the migration's `down` does nothing.

## Tests

`backend/test/models/document_in_project_test.rb`, `backend/test/services/loose_documents_test.rb`, `backend/test/models/document_root_test.rb`, the Space transfer tests, `frontend/src/data/folder.test.ts` (`folderChoices` with `inProductOnly`), `TransferDialog.test.tsx`, `useNewDocument.test.tsx`.

## History

- Implemented 2026-11-20. Backend tests (810) and RuboCop pass against a local PostgreSQL 16; the migration ran on the test database. Jest, ESLint (no errors) and tsc pass. Not deployed: the migration runs on the next deploy (deploys are manual).
