# Mac app local server without Docker

## What it does
A development build of the Mac app (`build/Inertia.app`, made by `make mac-build`) asks **Local** or **Cloud** on first launch. Choosing Local runs the whole server on this Mac with no Docker: when nothing answers on the API's `/up`, the app shows "Starting the local server…" and runs `make native-up` in its checkout, which starts PostgreSQL, the Rails API, the collab server and the web app as ordinary background processes, then opens the Space without a sign-in (the local API runs with `BYPASS_AUTH`). The same stack can be started, checked and stopped from a terminal with the `native-*` make targets.

| Command | Does |
| --- | --- |
| `make native-up` | Starts PostgreSQL (127.0.0.1:5433), the API (3847), the collab server (1234) and the web app (5174) in the background, installing gems and npm packages first when needed. Idempotent: anything already answering on its port is left alone. |
| `make native-down` | Stops the processes it started and PostgreSQL. |
| `make native-running` | Prints each process's state; exits non-zero when the stack is not up. |
| `make native-logs` | Tails `build/native/log/*.log`. |
| `make native-setup` | Finds the tools and installs the dependencies without starting anything. |

## How it works
- `scripts/native-server.sh` holds everything (`up`, `down`, `running`, `logs`, `setup`); the Makefile's **Local server without Docker** group wraps it. All state lives under the gitignored `build/native/`: `postgres/` (the database cluster), `bundle/` (gems, via `BUNDLE_PATH`), `log/`, `pid/` and `run/` (the PostgreSQL socket). npm packages go in each app's own `node_modules` (the Docker containers keep theirs in named volumes, so the two never fight).
- **Tools.** It installs nothing system-wide and picks what the Mac already has: a Ruby 3.3 or newer (Homebrew `ruby@3.3` first, then rbenv, the `ruby` on PATH, Homebrew `ruby`; `INERTIA_RUBY` overrides), a PostgreSQL server with `postgres`, `pg_ctl` and `initdb` (Homebrew `postgresql@16`/`@17`/`@18`, Postgres.app, `pg_ctl` on PATH, or a private copy unpacked into `build/native/postgresql`; `INERTIA_PG_BIN` overrides) and the `node` on PATH. A missing tool stops the script with the install command to run. libvips is optional: Rails boots without it and only skips image previews; `backend/Gemfile` loads `ruby-vips` lazily (`require: false`) for this, which changes nothing in Docker or production, where `image_processing` still requires it when a variant is made.
- **Environment.** The script exports the same settings `docker-compose.yml` gives the containers (`BYPASS_AUTH=true`, `JWT_SECRET_KEY`, `CORS_ORIGINS`, `APP_URL`, `WEB_URL`, `OAUTH_CALLBACK_BASE_URL`, `API_URL`, `COLLAB_URL`, `RAILS_INTERNAL_URL`), with the database at `127.0.0.1:5433` (`NATIVE_DB_PORT`) so it never collides with Docker's published 5432. `backend/config/database.yml` gained `port: ENV["DATABASE_PORT"]` (default 5432) for this; production's `DATABASE_URL` still wins.
- **PostgreSQL.** `initdb -U postgres --auth=trust` once, then `pg_ctl start` with a repo-local socket directory and `listen_addresses=127.0.0.1`. Credentials match the compose file (`postgres` / `password`; trust auth ignores the password).
- **Processes.** Each server starts detached in its own session through a one-line Ruby `Process.setsid` wrapper (macOS has no `setsid` command), so `down` can kill the whole process group (npm and the node it spawns) and never the shell, `make` or the Mac app that ran the script. The API starts after a synchronous `rails db:prepare` and `db/dev_user.rb`, so migration errors show in the script's output. `up` waits for `/up`, then for ports 1234 and 5174, and prints the last 30 log lines of a service that fails to come up.
- **Mac app.** `Session.startLocalServerIfDown` (in `macos/Sources/Inertia/Session.swift`) runs `/usr/bin/make -C <checkout> native-up` with Homebrew's bin directories prepended to `PATH` (apps opened from Finder get a minimal one), streams make's output to the unified log (`make logs-mac`), then polls `/up` for up to two minutes. The checkout is found from the bundle path (`LocalEndpoint.repositoryRoot`); an installed app in `/Applications` never starts anything. `ServerChoiceView` says Local runs "without Docker".
- Docker is untouched: `make dev`, `make up-d` and `make dev-all` still run the compose stack. If the compose stack is already up, `make native-up` sees the ports answering and starts nothing.

## Who can view and change
Anyone with the checkout; it is development tooling.

## Web entry points
None. The web app itself is unchanged; it is served from `http://localhost:5174` as before.

## Tests
- `macos/Tests/InertiaCoreTests/LocalEndpointTests.swift` covers the pieces the app relies on: which bundle paths are development builds, the checkout path above `build/Inertia.app`, and the Local/Cloud endpoints.
- The script has no automated test. Verified by hand as described in History.

## Known limits
- Only a development build starts the server; the installed app uses the cloud or whatever `INERTIA_API_URL` points at.
- Without libvips, uploaded image previews are not generated (`brew install vips` fixes it).
- The web port (5174) and collab port (1234) are fixed, as in the compose file; only `API_PORT` and `NATIVE_DB_PORT` can be changed.
- The script neither installs nor downloads Ruby or PostgreSQL. On a Mac whose Homebrew belongs to another user, install them into your own prefix or unpack a PostgreSQL build into `build/native/postgresql` and set `INERTIA_RUBY`.
- Redis is not started: nothing in the app uses it (`cable.yml` and the job queue are in-process).

## History
- Implemented 2026-11-20. Not deployed (development tooling only). Verified on a Mac without Docker: the gems install and Rails 8.1.4 boots on Homebrew's Ruby 4.0.6 without libvips, `npm ci` works for the web and collab apps, the Swift app builds and its 95 tests pass, lint passes. Not verified here: a full `make native-up` run (the sandbox this was written in would not start the downloaded PostgreSQL or background servers), so the first real run, `make native-down`, and the Mac app's end-to-end Local start still need a check on a Mac with PostgreSQL installed. Backend tests were not run (they need a database).
