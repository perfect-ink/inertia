---
priority: p1
depends_on: []
components: [backend]
branch: backlog/fix-document-share-lookup-across-spaces
status: incomplete
---
# Document shares can be read by id from any Space, and bad share input ends in a 500

## Objective

`Api::V1::SharesController` only lets people into the shares of Spaces they belong to, and answers a bad request with a 4xx instead of an error page. Found while writing `backend/test/controllers/shares_controller_test.rb` (task `request-tests-for-untested-controllers`); the tests leave these cases out on purpose, because they would fail today.

## Context

- **Cross-Space read.** `set_share` joins `shares` to `folders` with `... OR (shares.shareable_type = 'Document')` and filters with `OR (shares.shareable_type = 'Document')`, so every Document share matches whatever Space the person is in. `GET /api/v1/shares/:id` therefore returns the token of any document share to any signed-in person, and ids are sequential. The token opens `GET /api/v1/shared/:token`, which returns the document's content. `destroy` is not affected, because it then checks the role in the document's own Space (a stranger gets 404).
- **Unknown permission.** `share[permission]` that is not `view` or `edit` raises `ArgumentError` (the `Share.permission` enum does not validate), a 500, instead of a 422 with an `errors` list like every other controller.
- **Ids inside `share`.** `share_params` permits `folder_id` and `document_id`; the target is read from the top-level params, and `shareable.shares.build(...)` with those attributes raises `ActiveModel::UnknownAttributeError` (also a 500). They should not be permitted.

## Requirements

- Find a share by id only through its shareable's Space: Folder shares through `folders.workspace_id`, Document shares through the document's folder, both limited to the person's accessible Spaces. A share outside them is 404.
- Make an unknown `permission` a 422 with `errors` (an enum `validate: true`, or a check in the controller), and drop `folder_id` and `document_id` from `share_params`.
- No other behaviour changes. Roadmap links (`Workspace` shares, `RoadmapSharesController`) keep working unchanged.

## Acceptance criteria

- In `shares_controller_test.rb`: a stranger's `GET /api/v1/shares/:id` of a document share is 404, a share with `permission: "bogus"` is 422 and creates nothing, and a `share` that carries `folder_id` is ignored or refused, never a 500.
- The existing tests in that file and in `roadmap_shares_controller_test.rb` still pass.

## Unverified

Built (see [share_links.md](../features/share_links.md)):
- `Share.in_workspaces(ids)` (model scope): folder shares through `folders.workspace_id`, document shares through the document's folder; `SharesController#set_share` uses it, so a share in another Space is a 404. Roadmap (`Workspace`) shares stay out of `GET /api/v1/shares/:id` exactly as before and keep working through `RoadmapSharesController`.
- `enum :permission, ..., validate: true`: an unknown permission is a 422 with `errors`. `share_params` permits only `permission`.
- New `backend/test/controllers/shares_scoping_test.rb` (self-contained, no shared helper). It overlaps in topic with `backend/test/controllers/shares_controller_test.rb` on branch `backlog/request-tests-for-untested-controllers`; whichever merges second may want the two folded together (no file conflict, different names).

Security note for Alex: until this fix, any signed-in person could read the token of any document share by id (and open the document with it). Nothing was rotated or revoked here. Decide whether existing document share links need rotating; there is no UI that creates folder or document shares, so any were made through the API.

Ran: `ruby -c` on the model, controller and test file only. Not run (no Rails, database, network here): the Rails tests, RuboCop, and a real request against a database.

To verify:

```sh
cd backend && rails test test/controllers/shares_scoping_test.rb test/controllers/roadmap_shares_controller_test.rb
cd backend && rails test
cd backend && bundle exec rubocop app/models/share.rb app/controllers/api/v1/shares_controller.rb test/controllers/shares_scoping_test.rb
```

If `backlog/request-tests-for-untested-controllers` is merged first, also run `rails test test/controllers/shares_controller_test.rb`; that file's cases should still pass.
