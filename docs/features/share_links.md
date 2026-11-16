# Share links

## What it does
A share is a secret link to one folder, one document or (for the roadmap) one Space. Anyone who holds the link's token can read the item without signing in. Only the API exists for folders and documents; the one screen that uses shares is the roadmap's "Share read-only link" (see [roadmap.md](roadmap.md)).

## API and models
- `shares` table: `token` (random, unique), `permission` (`view` or `edit`), polymorphic `shareable` (`Folder`, `Document` or `Workspace`), `created_by_id`. `Share` is in `backend/app/models/share.rb`; `ShareBlueprint` renders it.
- `POST /api/v1/shares` (`{ folder_id | document_id, share: { permission } }`): creates a share of a folder or document in a Space the caller can write in. The target comes only from the top-level `folder_id` or `document_id`; ids inside `share` are ignored. A `permission` other than `view` or `edit` is a 422 with `errors` (the enum has `validate: true`). 404 for a target in a Space the caller cannot reach, 403 for a viewer.
- `GET /api/v1/shares/:id`: the share and its token, for anyone who belongs to the Space of the shared folder or document (including as a viewer, directly or through a team).
- `DELETE /api/v1/shares/:id`: revokes it; needs write access in that Space.
- `GET /api/v1/shared/:token` (no sign-in): the share with the shared folder (with children) or document (with content), or the roadmap snapshot for a Space.
- `GET/POST/DELETE /api/v1/roadmap_share`: the Space's own roadmap link, in `RoadmapSharesController`. Roadmap shares are not found through `/api/v1/shares/:id`.

## Who can view and change
A share is found by id only through the Space of its folder or document (`Share.in_workspaces`, which walks `folders.workspace_id`, and for a document its folder's Space), limited to the Spaces the caller reaches. A share in any other Space is a 404, the same as an id that does not exist. Creating and deleting need the member role or above in that Space. Whoever holds the token can read the item through `/api/v1/shared/:token`; that is the point of a link.

## Tests
- `backend/test/controllers/shares_scoping_test.rb`: a stranger gets 404 on a document share and a folder share by id (and cannot delete or create), people in the Space and someone in two Spaces read theirs, the roadmap share still works and is not found by id, an unknown permission is a 422 that creates nothing, `view` and `edit` still work, ids inside `share` never cause a 500 or retarget the share, a viewer still cannot create or delete, the public token link still opens.
- `backend/test/controllers/roadmap_shares_controller_test.rb`: the roadmap link.

## Known limits
- **Security note (fixed 2026-11-16): tokens were exposed across Spaces.** Before this fix, `GET /api/v1/shares/:id` matched every document share whatever Space it was in, so any signed-in person could read the token of any document share by its (sequential) id, and then open the document with `/api/v1/shared/:token`. Folder shares were scoped correctly. The fix does not rotate or revoke anything: existing document share links keep working. Whether any were exposed, and whether to rotate existing document share links, is for Alex to decide; there is no UI that creates folder or document shares, so any that exist were made through the API.
- There is no screen to create, list or revoke folder or document shares.
- A share's permission (`view`/`edit`) is stored, but `GET /api/v1/shared/:token` is read-only whatever it says.

## History
- Implemented 2026-11-16 (branch `backlog/fix-document-share-lookup-across-spaces`, not merged or deployed): Space-scoped lookup, 422 for an unknown permission, `folder_id` and `document_id` no longer permitted inside `share`. Not verified here: the Rails tests, RuboCop and the app itself (no Rails, database or network in this environment); only `ruby -c` ran.
- Not implemented: rotating existing share tokens, a share UI for folders and documents.
