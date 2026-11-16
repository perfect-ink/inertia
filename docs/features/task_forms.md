# Forms that create tasks

## What it does
`/forms` ("Forms" in the product sidebar's Views list, which is folded until opened; a product can turn the page off, see [project_features.md](project_features.md)) lists the Space's forms. A form asks a few questions and turns each filled-in copy into a task in the Space. It is separate from product intake (see [project_intake.md](project_intake.md)): that asks for a product and needs approval, a form here makes a plain task straight away.

- **Build** (members, admins, owners): "New form" asks for a title and opens the builder at `/forms/:id/edit`. A new form starts with a required Title question and an optional Details question. The builder has three parts.
  - Settings: title, description (shown above the questions) and "Accepting responses" (turn off to close the form).
  - Where the tasks go: the status the tasks start in (default Backlog, shown with the names the chosen folder or Space gives the statuses, see [configurable_statuses.md](configurable_statuses.md)), an epic, a folder or product, and an assignee (a Space member). All optional.
  - Questions (up to 20): label, type (short text, long text, date, choice), which part of the task the answer fills in, required, and for a choice the options, one per line (at least two). Questions can be moved up and down and removed. One question must fill in the task title (it is always required and cannot be removed while it does).
- **Products**: forms follow the open product like every other list. With a product open, `/forms` lists the forms filed in that product or its subfolders, and a new form is filed in the product (the builder's "Folder or product" shows it and can change it; "None" makes it Space-wide, listed only when no product is open). With no product open the list is every form in the Space. A form's own pages (`/forms/:id`, `/forms/:id/edit`) open whichever product is open. (Code, the API and the `X-Project-Id` header keep the name `project`.)
- **What an answer fills in**: the task title (short text), description (short or long text), start date or due date (date), or "extra detail". Each of title, description, start date and due date can be asked for once. Extra details (any type) are written into the task description as `Label: answer` lines after the description answer.
- **Fill in** (members, admins, owners): "Fill in" on the list, or on the builder, opens `/forms/:id`. Required questions left blank are reported before anything is sent. The server checks dates, choices and lengths. On success the page names the task and links to Tasks. The new task is filed where the form says (status, epic, folder or product, assignee) and its creator (the task's auto field, see [task_auto_fields.md](task_auto_fields.md)) is the person who filled the form in (empty for a public response). An assignee other than the person filling in is notified, as for any assigned task; the task's status history names the person who filled the form in.
- **Responses**: the builder lists the latest 50 responses with the task title, who sent it (or "Public link"), the date, the task's status and every answer as it was worded when it was sent (editing the form later does not rewrite old answers).
- **Public link** (optional, off): see below.

### Public link (conservative version, needs Alex's decision)
Tasks can also be created by someone with no account, through `/f/<token>` (a plain web path like `/invite/<token>`; nginx already serves it from `index.html`, so no nginx change was needed, and `/api/` already reaches Rails). Because this lets anyone on the internet create tasks in a Space, it is off in three ways:
1. The server refuses to turn it on unless the deployment sets `PUBLIC_FORMS_ENABLED=true` (read in `backend/config/initializers/public_forms.rb`; passed through `docker-compose.coolify.yml`, default `false`; see `docs/services.md` and `docs/deployment.md`). Unset, the builder's checkbox is disabled and every public address answers 404.
2. Each form has to be switched on by an admin or owner of the Space (any member can switch it off). It is off by default.
3. The address holds a random token (192 bits). Switching public access off and on again gives a new token, so a leaked link can be retired.

Limits on abuse, all checked before a task is made: a form that is closed, private, or whose token is wrong answers 404 to everyone, so a dead link doesn't say why. One address can send 10 public responses an hour (then 429 "try again later"; counted by Rails' `rate_limit` in the server process's memory, so each server process keeps its own count, and guesses at tokens count too). The address is `request.remote_ip`, which relies on nginx passing `X-Forwarded-For` (it does, `frontend/nginx/default.conf`) and Traefik in front of it; if that chain were wrong every visitor would share one allowance, so check it after the first deploy (see the task file). Each form accepts at most 30 public responses an hour in all (counted in the database, so this one is exact). A hidden "website" field catches simple bots (they get a "thanks" and no task). Answer lengths are capped (255 characters for short text, 5,000 for long text). The public page shows only the questions, never the epic, folder, assignee or Space. Answers are filtered out of the request log. There is no CAPTCHA and no email or contact field, so a public response is anonymous.

## API and models
- `task_forms` table (model `TaskForm`, shown as "Form"): `workspace_id`, `title` (required), `description`, `questions` (JSON list), `token` (unique), `enabled`, `public_access`, `default_status` (a task status, default `backlog`), `epic_id`, `folder_id`, `assignee_id`, `created_by_id`. The epic, folder, assignee and creator fall back to none if deleted. The epic and folder must be in the same Space, the assignee a Space member. Migration `20261116070001_create_task_forms_and_submissions.rb`.
- `task_form_submissions` table (`TaskFormSubmission`, "Response"): `task_form_id`, `task_id` (deleting the task deletes the response), `submitted_by_id` (null for a public response), `answers` (JSON list of `label`/`value`).
- `TaskFormSchema` (plain Ruby, `app/models/task_form_schema.rb`) holds the rules: question shape, which kinds can fill in which part of the task, and turning answers into task attributes. `TaskForm#submit` builds the task and the response in one transaction and returns an outcome with the errors, if any. A closed form returns "This form is closed".
- `GET/POST /api/v1/task_forms`, `GET/PATCH/DELETE /api/v1/task_forms/:id` (the list includes `submissions_count` and honours `X-Project-Id`; `GET :id` ignores it; `token` is only sent while the form is public).
- `GET/POST /api/v1/task_forms/:id/submissions`: list the latest 50, or fill in as a signed-in member (body `{ answers: { <question id>: "text" } }`; 422 with `errors` on a problem).
- `GET /api/v1/public_forms/:token` and `POST /api/v1/public_forms/:token/submissions` (no sign-in; body `{ answers, website }`; answers `{ submitted: true }`; 404 unless the form is open and public and the server allows it; 429 over a limit).
- Frontend: `api/taskForms.ts` (a `TaskFormApi` class on the API base, plus `PublicTaskFormApi`), types in `types/taskForm.ts`, pure rules in `data/taskForm.ts` (including the public address, `/f/<token>`).

## Who can view and change
- Scoped to the Space named by `X-Workspace-Id`; a form of another Space is 404.
- View the list and responses: any member, including viewers.
- Create, edit, delete, fill in: members, admins, owners (viewers get 403, like every other write).
- Turn the public link on: admins and owners (403 for a member). Turn it off, or save other changes while it is on: any member.
- The public endpoints need nothing but the token, and only while the server flag, `public_access` and `enabled` are all on.

## Web entry points
- `view/forms/FormsScreen.tsx` (`/forms`), `view/form_builder/FormBuilderScreen.tsx` with `QuestionEditor.tsx` (`/forms/:id/edit`), `view/form_fill/FormFillScreen.tsx` (`/forms/:id`), `view/public_form/PublicFormScreen.tsx` (`/f/:token`, outside the sign-in guard). The shared question controls are `components/forms/TaskFormFiller.tsx`. Routes in `App.tsx`; the Views entry (shown unless the product turns Forms off) comes from `components/file-manager/projectSections.ts`.
- Failed calls show the shared error notice; the fill-in and builder pages also show the reason next to the form. The public page handles its own errors (a missing link is a page, not a notice).

## Tests
- `backend/test/models/task_form_schema_test.rb` (pure), `backend/test/models/task_form_test.rb`
- `backend/test/controllers/task_forms_controller_test.rb` (roles, product scoping, show, public-link permissions), `backend/test/controllers/public_forms_controller_test.rb` (404s, honeypot, per-form cap, per-address cap)
- `frontend/src/data/taskForm.test.ts`, `components/forms/TaskFormFiller.test.tsx`, `view/forms/FormsScreen.test.tsx`, `view/form_builder/FormBuilderScreen.test.tsx`, `view/form_fill/FormFillScreen.test.tsx`, `view/public_form/PublicFormScreen.test.tsx`, plus `data/projectFeature.test.ts`, which checks every page in the product sidebar has its feature, and `components/file-manager/ProjectSidebar.test.tsx` (Forms in the Views list)
- `backend/test/services/slug_test.rb` (`forms` and `f` are reserved first path segments)

## Known limits
- A form creates top-level tasks only: no sprint, milestone, parent task, priority or custom field answers, and no document is created.
- A response is not linked from the task (the task page has no "came from form X"), and the response list shows the latest 50 only.
- No notification or email when a form is filled in (other than the assignee notice every assigned task gives); no confirmation text or redirect can be set for the "thanks" step.
- Question types are fixed (no number, email, file upload, multi-select or conditional questions). The Space's custom task fields are not offered as answers.
- The public page has no CAPTCHA and collects no contact details. The per-address limit is counted per server process (the per-form limit is exact), and an address shared by many people (an office) shares one allowance.
- In the Views list Forms is only marked as current on `/forms`, not on a form's own pages.
- Editing a form's questions does not change tasks already made. Removing a question keeps its old answers in past responses.
- A folder that a form files its tasks in cannot be moved to another Space until the form points elsewhere (see [space_transfer.md](space_transfer.md)).
- `forms` and `f` are reserved first path segments (`Slug::RESERVED`, [hierarchical_urls.md](hierarchical_urls.md)), so a new top-level folder named "Forms" gets the slug `forms-2`. A top-level folder that already had the slug `forms` or `f` is no longer reached by its path (its `/folders/:id` address still works).
- A product that had already saved its own list of pages does not show Forms until someone ticks it (products with no saved list show it).
- Copying a folder or Space does not copy its forms.

## History
- Implemented 2026-11-02 on branch `backlog/forms-that-create-tasks` (builder, fill-in page, responses, optional public link); not deployed.
- 2026-11-09: resumed on top of current `main`: public address is a clean path, forms follow the open product (list, new forms, `GET :id`), status names come from the Space or folder, a per-address limit on public responses, the server flag is read in an initializer and passed through `docker-compose.coolify.yml`, and the person who fills a form in is recorded as the actor on the task.
- 2026-11-20: rebased onto current `main` as one commit (custom fields on tasks, products' page lists, the two-sidebar navigation, Products wording and the AI worker changes landed meanwhile): Forms joined the product page list (`forms`, listed under Views in the product sidebar), the new task's creator is recorded, `forms` and `f` joined the reserved slugs, and the migration was renumbered `20261116070001`.
- Decision for Alex: public submission is built but off (server flag, admin switch, token, per-address and per-form caps, honeypot). Leave `PUBLIC_FORMS_ENABLED` unset to keep forms internal. Whether to ship it at all, and whether it needs a CAPTCHA first, is Alex's call.
- Not implemented: CAPTCHA, contact fields, sprint/priority/custom-field targets, notifications to the form owner, linking a task back to its form.
- Not verified: the migration (`schema.rb` was edited by hand), Rails tests, `npm run lint`, `tsc`, the real Jest run, and the pages in a browser at 375px and desktop, light and dark (no database, node_modules or network here).
