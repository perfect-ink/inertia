# Quip import

Imports a person's Quip account into a Space: the Desktop, Starred and Shared folders and every document in them, with the folder structure kept.

## What it does for users

- The account menu at the foot of the sidebar has "Import from Quip". The dialog asks for the Quip API token and the domain (`quip.com` or `quip-apple.com`) and shows progress until the import settles (polled every 1.5 s).
- The import runs in the background (`QuipImportJob`, in-process queue). It creates folders and documents at the top level of the Space, or under the destination folder when the request names one (the web dialog does not).
- The token is read from the one request and handed to the job as an argument. It is never stored on `quip_imports` or any other table.

## API and models

- `POST /api/v1/quip_imports` takes `token` (required), `domain` (default `quip.com`) and `destination_folder_id` (optional). It answers 201 with the import (`QuipImportBlueprint`: status, domain, counts, error message, timestamps, `destination_folder_id`).
- `GET /api/v1/quip_imports` lists the Space's imports, newest first; `GET /api/v1/quip_imports/:id` shows one.
- `QuipImport` belongs to a workspace and optionally to a destination folder; status is `pending`, `running`, `completed` or `failed`.
- `Quip::Importer` (`backend/app/services/quip/`) does the walk; `Quip::Client` talks to the Quip API.

## Who can do what

Reading the list needs access to the Space; starting an import is a write, so it needs the member role or above (`WorkspaceScoped`). The Space comes from the `X-Workspace-Id` header.

## Checked before anything is saved

`create` refuses a bad request before it writes a row or queues a job:

- no (or blank) `token`: 400, no import, no job;
- a `destination_folder_id` that is not a folder of this Space: 404 like every other folder id, no import, no job.

Before this a request without a token left a `pending` import that no job would ever run, and a folder from another Space was saved and only failed later inside the job.

## Tests

- `backend/test/controllers/quip_imports_scoping_test.rb`: missing and blank token, a folder from another Space, a valid request (job queued with the token, token not echoed), and a folder in the Space kept as the destination.
- `backend/test/models/quip_import_test.rb`: domain list and default status.

## Known limits

- No request test yet for the rest of the controller (list, show, a Space the person is not in); see the backlog task `request-tests-for-untested-controllers`.
- The web dialog cannot pick a destination folder.
- The in-process queue loses a running import if the server restarts.

## History

- Implemented 2026-11-16: the token and the destination folder are checked before the import is saved. Not deployed. Not verified by a run: Rails cannot run in the environment this was written in (see the task file's Unverified section).
