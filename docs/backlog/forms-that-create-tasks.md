---
priority: p2
depends_on: []
branch: backlog/forms-that-create-tasks
status: incomplete
---
# Forms that create tasks (public or internal)

## Objective

Forms that create tasks (public or internal)

## Current state

None

## Context

Section "Collaboration" of the retired shared backlog.

## Acceptance criteria

- Forms that create tasks (public or internal) works as described in the Objective, for a signed-in member of the Space, in the web app.
- Failed API calls show an error to the user.
- Tests cover the new behaviour; a feature doc in `docs/features/` is written (or the existing one updated) and this file is removed.

## Decision for Alex (privacy and abuse)

The acceptance criterion is the signed-in version, so that is what ships on. The title also says "public", so a logged-out version is built, but it is **off** and needs all of these:

1. `PUBLIC_FORMS_ENABLED=true` on the `api` service (default `false` in `docker-compose.coolify.yml`; unset or false, every public address is a 404 and the builder cannot turn the link on).
2. An admin or owner switches the individual form's public link on (a member cannot; any member can switch it off). Off by default.
3. An unguessable 192-bit token in the address (`/f/<token>`), new each time the link is switched on.

Abuse limits, applied before a task is made: 10 responses an hour per address (Rails `rate_limit`, counted per server process), 30 an hour per form (counted in the database), a honeypot field, answer length caps, a 404 for anything closed, private or wrong. There is no CAPTCHA and no contact field. Leave the variable unset to keep forms internal. If public forms should ship, decide whether they need a CAPTCHA (a new third-party service, so not added) or a shared-cache rate limit first. No nginx change is needed: `/f/<token>` falls through to `index.html` and `/api/` already reaches Rails.

## Unverified

Built across four sessions (2026-11-02, 2026-11-09, 2026-11-16, 2026-11-20). On 2026-11-20 the branch was rebased as one commit onto current `origin/main` (d8d1ce27: two-sidebar navigation, Products wording, documents in products). In that pass: the page list in `projectSections.ts` no longer has icons, so Forms is a plain `{ label, feature: 'forms', path }` row listed under Views in the product sidebar; `ProjectNav` and its test are gone on main, so the Forms assertion moved into `ProjectSidebar.test.tsx`; user-facing "project" became "Product" ("Folder or product" in the builder, the feature docs); `schema.rb` keeps main's `version: 2026_11_20_200001` with the two form tables re-applied (the migration stays `20261116070001`, which is older than main's latest, so `rails db:migrate` runs it as a pending migration). Earlier passes: Forms is a project page a product can turn off (`forms` in `Folder::PROJECT_FEATURES` and `data/projectFeature.ts`), a form's tasks record their creator (`created_by`), `forms` and `f` joined `Slug::RESERVED`. Not merged. Everything below could not run here (no database, `node_modules`, `bundle` or network).

**Ran (offline, 2026-11-20 after the rebase):** `ruby -c` on every changed Ruby file and the YAML locale; `backend/test/models/task_form_schema_test.rb` and `backend/test/services/slug_test.rb` through a stub helper (9 and 11 tests pass, including the "every first segment of a route in App.tsx is reserved" scan); `JEST_STUB_NET=1 /tmp/runner/all.sh` (static parse, sass compile, the pure data tests including `data/taskForm.test.ts` and `data/projectFeature.test.ts`, and the Jest stand-in for the forms, builder, fill-in and public form tests), plus `ProjectSidebar.test.tsx`, `SpaceSidebar.test.tsx` and `ProjectFeaturesDialog.test.tsx` through the stand-in. The stand-in also reports two failing `toggleTaskDone` cases in `util/editorCommand.test.ts` and the known `window is not defined` in `util/shortcuts.test.ts`, which this branch does not touch.

**Not run:** `rails db:migrate`, `rails test` (model, controller, public-endpoint and rate-limit tests are unrun; the controller tests assume the usual JWT test setup), `npm run lint`, `stylelint`, `tsc -b`, the real `npm test`, `rubocop`, and any browser check.

**To verify and merge:**
1. `cd backend && rails db:migrate && git diff db/schema.rb` (the `task_forms` and `task_form_submissions` tables; `schema.rb` was edited by hand and keeps main's `version:`), then `rails test` and `make lint-backend`.
2. `cd frontend && npm install && npm run lint && npx tsc -b && npm test`.
3. In a browser at 375px and desktop, light and dark: `/forms` (create a form, add each question type, reorder, change the destination folder and see the status names follow it, save, fill it in, see the response and the new task on `/tasks`, with you as its creator in the task dialog); with a product open, open Views in its sidebar, pick Forms, and check the list is that product's forms and a new form lands in it; turn Forms off in the product's **Choose pages...** and see it leave Views. With `PUBLIC_FORMS_ENABLED=true` as an admin, turn the public link on, open the copied `/f/<token>` link in a private window and submit, send 11 responses from one address and see the 429 message, check a second address is not blocked (confirms `X-Forwarded-For` reaches Rails), then switch the link off and check it shows "This form isn't available".
4. Decide whether public forms should ship (see the decision above).

**Merge hazards:** edits `backend/config/routes.rb`, `backend/db/schema.rb` (keep the higher `version:` on a conflict), `backend/config/locales/en.yml`, `backend/app/models/{workspace,folder,epic}.rb` (one `has_many :task_forms` each; `folder.rb` also gets `forms` in `PROJECT_FEATURES`), `backend/app/services/slug.rb`, `backend/app/services/space_transfer.rb`, `backend/config/initializers/filter_parameter_logging.rb` (adds `:answers`), `frontend/src/App.tsx`, `frontend/src/data/projectFeature.ts`, `frontend/src/components/file-manager/projectSections.ts`, `docker-compose.coolify.yml`, `docs/deployment.md`, `docs/services.md`, `docs/features/{README,project_features,space_transfer,two_sidebar_navigation}.md`.
