---
priority: p2
depends_on: [hierarchical-urls, backlinks-each-document-lists-which-documents-link-to]
components: [backend]
branch: backlog/backlinks-from-hierarchical-path-links
status: incomplete
---
# Backlinks from links written as hierarchical paths

## Objective

Count a link in a document as a backlink when its address is a hierarchical path (`/product/feature-folders/requirements`) as well as when it is an id path (`/documents/12`).

## Requirements / notes

`DocumentLink.target_ids_in` (`backend/app/models/document_link.rb`) reads only id addresses (`/documents/<id>`, with or without a heading, the hash router's form, or behind a host). Once hierarchical URLs merge, an address copied from the browser's address bar after the page rewrites itself is a slug path, so a link pasted that way is not seen. The heading link picker and the `[[` link keep writing id paths, which are unaffected.

Resolve such a path with the hierarchical URL lookup (`PathResolver`, which also follows old paths of renamed or moved items) in the document's own Space, when the link's host is the app's or the link is relative. Keep matching by id, so a rename or move of the target never loses the backlink, and keep the same-Space rule.

## Acceptance criteria

- A document that links to another through a slug path (including an old, redirected one) is listed in that document's "Linked from" section; a path that names a folder, or nothing, adds no backlink.
- Saving stays fast: one lookup per distinct path, none for id paths.
- Tests cover slug paths, old paths and paths in another Space; `docs/features/document_backlinks.md` is updated and this file is removed.

## Unverified

Done: `LinkAddress` (`backend/app/services/link_address.rb`, pure: reads relative, hash-router and app-host hrefs as slug paths, skipping id paths, app pages, other sites and non-slug segments), `config/initializers/app_origins.rb` (the app's own hosts from `APP_URL`, `WEB_URL` and `CORS_ORIGINS`, no new variable), `DocumentLink.targets_in` / `path_target_ids` and a `refresh!` that resolves each distinct path once with `PathResolver.find` in the document's own Space (old paths included, documents only, at most 100 paths per save), the Minitest tests, and the docs (`docs/features/document_backlinks.md`, `hierarchical_urls.md`, `docs/services.md`, `docs/deployment.md`).

Decisions for Alex (conservative): a pasted absolute address only counts when its host is `APP_URL`, `WEB_URL` or one of `CORS_ORIGINS` (a second domain is not read); id addresses keep matching on any host as before; the path is looked up when the source is saved, not when the target changes.

Ran here: `ruby -c` on the changed files; a stand-alone Ruby run of `LinkAddress`, `DocumentLink.targets_in` and `path_target_ids` (38 checks, with stubbed `PathResolver`/`Document`) and of `link_address_test.rb` under plain Minitest (8 tests pass).

Not run (no database, `bundle` or network): the Rails tests, RuboCop, and the new `document_link_test.rb` cases (they need records and `PathResolver`).

To verify:

```sh
cd backend && rails test test/services/link_address_test.rb test/models/document_link_test.rb test/services/path_resolver_test.rb
cd backend && bundle exec rubocop app/models/document_link.rb app/services/link_address.rb config/initializers/app_origins.rb test/services/link_address_test.rb test/models/document_link_test.rb
cd backend && rails test
```

Then run `rails document_links:rebuild` once after deploy so documents saved earlier pick up pasted-path links. When verified, delete this file (see `docs/rules/backlog.md`, Completing Work).
