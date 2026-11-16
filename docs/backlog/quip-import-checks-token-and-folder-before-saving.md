---
priority: p3
depends_on: []
components: [backend]
branch: backlog/quip-import-checks-token-and-folder-before-saving
status: incomplete
---
# A Quip import without a token leaves a pending import behind

## Objective

`Api::V1::QuipImportsController#create` refuses a bad request before it saves anything. Found while writing `backend/test/controllers/quip_imports_controller_test.rb` (task `request-tests-for-untested-controllers`); the tests only assert the status codes there, because the row count would fail today.

## Context

- `create` runs `current_workspace.quip_imports.create!(...)` first and `params.require(:token)` afterwards (as an argument of `QuipImportJob.perform_later`). A request without a token answers 400 but has already written a `pending` import that no job will ever run, and it then shows in `GET /api/v1/quip_imports` for good.
- `destination_folder_id` is not checked against the Space. A folder from another Space is saved, and the import only fails later, in the job, when `Quip::Importer` creates its first folder under it ("Parent must belong to the same space"). It should be refused with a 422 up front.

## Requirements

- Read the token (`params.require(:token)`) before creating the import.
- Look the destination folder up in `current_workspace.folders` (404 or 422 when it is not there).
- No other behaviour changes.

## Acceptance criteria

- In `quip_imports_controller_test.rb`: a request without a token creates no `QuipImport` and queues no job; a `destination_folder_id` from another Space is refused and creates no import.

## Unverified

Built: `QuipImportsController#create` reads `params.require(:token)` and looks `destination_folder_id` up through `current_workspace.folders.find` before `quip_imports.create!`. A missing or blank token answers 400 and a folder outside the Space answers 404 (the convention of the neighbouring controllers; the 422 option was not used). Nothing else changed: the web dialog sends only `token` and `domain`, so valid requests behave as before. New self-contained test `backend/test/controllers/quip_imports_scoping_test.rb` (no token, blank token, other Space's folder, valid request, own folder); feature doc `docs/features/quip_import.md`.

Ran: `ruby -c` on the controller and the test.

Not run (no Rails, database or gems in the environment): the Rails tests and RuboCop. To verify:

```bash
cd backend && bin/rails test test/controllers/quip_imports_scoping_test.rb test/models/quip_import_test.rb
cd backend && bundle exec rubocop app/controllers/api/v1/quip_imports_controller.rb test/controllers/quip_imports_scoping_test.rb
make test
```

Merge note: `backlog/request-tests-for-untested-controllers` also writes `quip_imports_controller_test.rb` and edits `docs/features/rules_compliance.md`; its test asserts the status codes only and should then assert the row count and job as the acceptance criteria say.
