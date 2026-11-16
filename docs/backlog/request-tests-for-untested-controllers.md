---
priority: p2
depends_on: []
components: [backend]
branch: backlog/request-tests-for-untested-controllers
status: incomplete
---
# Request tests for the controllers that have none

## Objective

Every API controller is covered by a request test, as `docs/rules/backend.md` (API) asks.

## Context

The rules audit (see `docs/features/rules_compliance.md`) matched each controller in `backend/app/controllers/` to the tests in `backend/test/` by file name and by the URLs the tests call. These have no request test at all:

- `Api::V1::EventsController` (`/api/v1/events`) and `EventTasksController` (events and their tasks)
- `Api::V1::SharesController` (`/api/v1/shares` and the public `/api/v1/shared/:token`)
- `Api::V1::QuipImportsController` (`/api/v1/quip_imports`)
- `Api::V1::Auth::RegistrationsController` (sign-up) and `Auth::SessionsController` (sign-in and sign-out)
- `Api::V1::TeamMembersController` (`/api/v1/teams/:id/members`; only touched indirectly by `teams_controller_test.rb`)

Others are covered only under another test's name (for example documents, folders, epics, initiatives and key results), so they are fine for now.

## Requirements / notes

- One `*_controller_test.rb` per controller above in `backend/test/controllers/`, copying the patterns of the neighbouring tests (`tasks_controller_test.rb`, `teams_controller_test.rb`).
- Cover the happy path, a refused request (unauthenticated, or a Space the person is not in) and one validation error for each action. For shares, cover the public token access and that a deleted share stops working.
- No behaviour change: if a test finds a bug, note it in the test's commit or a new backlog file rather than fixing it here.

## Acceptance criteria

- `rails test` passes with a request test for each controller listed.
- `docs/features/rules_compliance.md` (backend.md API row) is updated.

## Unverified

Done on the branch (Minitest request tests only, no behaviour change), each copying the sign-in and Space setup of `teams_controller_test.rb`:

- `backend/test/controllers/events_controller_test.rb` (list, project scoping, create, update, delete, signed out, viewer, outsider, another Space's event)
- `backend/test/controllers/event_tasks_controller_test.rb` (link, link twice, foreign task or event, unlink, signed out, viewer, outsider)
- `backend/test/controllers/shares_controller_test.rb` (create for a document and a folder, show, the public `/api/v1/shared/:token`, a deleted share or document stops working, signed out, viewer, outsider)
- `backend/test/controllers/quip_imports_controller_test.rb` (start with the token only going to `QuipImportJob`, domain check, list, show, signed out, viewer, outsider)
- `backend/test/controllers/team_members_controller_test.rb` (add, remove, who may manage, signed out, outsider, another team or Space)
- `backend/test/controllers/sessions_controller_test.rb` (sign-in, wrong password, unknown email, sign-out revokes the token)
- `backend/test/support/request_auth.rb` (shared `api_headers` and `create_person`)

`Auth::RegistrationsController` already has `signup_api_test.rb` (201 with a token, 422 messages), so no second file was added. Sign-in's development shortcut stays in `development_login_test.rb`.

Ran: `ruby -c` on every new file, and the offline runner's static pass. Not run (no gems, no database here): `rails test`, RuboCop. The tests were written from reading the controllers, routes, models and blueprints; the least certain ones are the ones that lean on Rails and Devise internals (a missing `share` or `token` param is a 400, an invalid Quip domain is a 422 through `create!`, sign-out revokes the JWT and answers 200 even without a token). If one of those fails, fix the test, not the controller.

Verify on a machine with the gems and a database:

```sh
cd backend
rails test test/controllers/events_controller_test.rb
rails test test/controllers/event_tasks_controller_test.rb
rails test test/controllers/shares_controller_test.rb
rails test test/controllers/quip_imports_controller_test.rb
rails test test/controllers/team_members_controller_test.rb
rails test test/controllers/sessions_controller_test.rb
rails test
bundle exec rubocop test/controllers test/support
```

Bugs found while reading (not fixed, not tested): `fix-document-share-lookup-across-spaces` and `quip-import-checks-token-and-folder-before-saving` in `docs/backlog/`. The `docs/features/rules_compliance.md` API row is updated; once the tests pass, delete this file and mark that row Met.
