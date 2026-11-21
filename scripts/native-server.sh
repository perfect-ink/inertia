#!/bin/bash
# The local Inertia stack on this Mac, without Docker: PostgreSQL, the Rails
# API (port 3847), the collab server (1234) and the webpack dev server (5174).
# Each runs as a detached background process, with its pid and log under
# build/native/. `make native-up`, `native-down`, `native-running`,
# `native-logs` and `native-setup` wrap the commands below; the Mac app's
# "Local" choice runs `make native-up` in its checkout when nothing answers
# on /up (see macos/Sources/Inertia/Session.swift).
#
# It uses the tools already on the Mac and installs nothing system-wide:
#   Ruby 3.3 or newer   Homebrew's ruby@3.3 (preferred) or ruby, rbenv, or
#                       the ruby on PATH; INERTIA_RUBY=/path/to/ruby overrides.
#   PostgreSQL server   Homebrew's postgresql@16 (or 17, 18), Postgres.app, a
#                       pg_ctl on PATH, or a private copy unpacked into
#                       build/native/postgresql; INERTIA_PG_BIN=/path/to/bin
#                       overrides. Its data lives in build/native/postgres and
#                       it listens on 127.0.0.1:5433 (NATIVE_DB_PORT), so it
#                       never collides with Docker's 5432.
#   Node                the node on PATH (Homebrew's).
#   libvips             optional; without it Rails still boots, but uploaded
#                       image previews are not generated.
# Gems install under build/native/bundle; npm packages under each app's own
# node_modules (the Docker containers keep theirs in named volumes).
#
# Usage: scripts/native-server.sh up|down|running|logs|setup
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT=$PWD
NATIVE=$ROOT/build/native
LOG_DIR=$NATIVE/log
PID_DIR=$NATIVE/pid
RUN_DIR=$NATIVE/run
PGDATA=$NATIVE/postgres
API_PORT=${API_PORT:-3847}
WEB_PORT=5174
COLLAB_PORT=1234
DB_PORT=${NATIVE_DB_PORT:-5433}
mkdir -p "$LOG_DIR" "$PID_DIR" "$RUN_DIR"

# Same settings docker-compose.yml gives the containers, with the database on
# this Mac instead of the `postgres` service.
export DATABASE_HOST=127.0.0.1 DATABASE_PORT=$DB_PORT DATABASE_USERNAME=postgres DATABASE_PASSWORD=password
export JWT_SECRET_KEY=${JWT_SECRET_KEY:-dev_secret_change_in_production}
export CORS_ORIGINS=${CORS_ORIGINS:-http://localhost:$WEB_PORT,capacitor://localhost}
export BYPASS_AUTH=${BYPASS_AUTH:-true}
export APP_URL=http://localhost:$API_PORT WEB_URL=http://localhost:$WEB_PORT
export OAUTH_CALLBACK_BASE_URL=${OAUTH_CALLBACK_BASE_URL:-http://localhost:$API_PORT}
export BUNDLE_PATH=$NATIVE/bundle
# Apps opened from Finder get a minimal PATH that lacks Homebrew.
export PATH=/opt/homebrew/bin:/usr/local/bin:$PATH

fail() { echo "error: $*" >&2; exit 1; }

# ── Tools ─────────────────────────────────────────────────────────────────────

ruby_is_recent() { [ -x "$1" ] && "$1" -e 'exit((RUBY_VERSION.split(".").map(&:to_i) <=> [3, 3]) >= 0)' 2>/dev/null; }

find_ruby() {
  local candidate
  for candidate in "${INERTIA_RUBY:-}" \
      /opt/homebrew/opt/ruby@3.3/bin/ruby /usr/local/opt/ruby@3.3/bin/ruby \
      "$HOME"/.rbenv/versions/3.3*/bin/ruby "$HOME"/.rubies/ruby-3.3*/bin/ruby \
      "$(command -v ruby || true)" \
      /opt/homebrew/opt/ruby/bin/ruby /usr/local/opt/ruby/bin/ruby; do
    if [ -n "$candidate" ] && ruby_is_recent "$candidate"; then echo "$candidate"; return 0; fi
  done
  return 1
}

find_postgres_bin() {
  local dir
  for dir in "${INERTIA_PG_BIN:-}" "$NATIVE/postgresql/bin" \
      /opt/homebrew/opt/postgresql@16/bin /opt/homebrew/opt/postgresql@17/bin /opt/homebrew/opt/postgresql@18/bin /opt/homebrew/opt/postgresql/bin \
      /usr/local/opt/postgresql@16/bin /usr/local/opt/postgresql@17/bin /usr/local/opt/postgresql/bin \
      /Applications/Postgres.app/Contents/Versions/latest/bin \
      "$(dirname "$(command -v pg_ctl 2>/dev/null || echo /nonexistent/pg_ctl)")"; do
    if [ -n "$dir" ] && [ -x "$dir/postgres" ] && [ -x "$dir/pg_ctl" ] && [ -x "$dir/initdb" ]; then echo "$dir"; return 0; fi
  done
  return 1
}

find_tools() {
  RUBY=$(find_ruby) || fail "no Ruby 3.3 or newer found. Install one (brew install ruby@3.3) or set INERTIA_RUBY=/path/to/ruby."
  RUBY_BIN=$(dirname "$RUBY")
  PG_BIN=$(find_postgres_bin) || fail "no PostgreSQL server found. Install one (brew install postgresql@16, or Postgres.app), unpack a copy into build/native/postgresql (so build/native/postgresql/bin/postgres exists), or set INERTIA_PG_BIN=/path/to/bin."
  command -v node >/dev/null 2>&1 || fail "node not found. Install it (brew install node)."
  export PATH=$RUBY_BIN:$PG_BIN:$PATH
  # Source builds of the pg gem (when no binary gem fits this Ruby) need pg_config.
  export BUNDLE_BUILD__PG="--with-pg-config=$PG_BIN/pg_config"
  if ! [ -e /opt/homebrew/opt/vips/lib/libvips.42.dylib ] && ! [ -e /usr/local/opt/vips/lib/libvips.42.dylib ]; then
    echo "note: libvips not found; uploaded image previews won't be generated (brew install vips)."
  fi
  echo "Using $("$RUBY" -v | cut -d' ' -f1-2) at $RUBY, $("$PG_BIN/postgres" --version) at $PG_BIN, node $(node --version)"
}

# ── Dependencies ──────────────────────────────────────────────────────────────

# `npm ci` only when package.json or the lockfile changed since the last one
# (the same stamp frontend/scripts/start-dev.sh keeps in the container).
npm_dependencies() {
  local dir=$1 stamp current installed
  stamp=$dir/node_modules/.inertia-dependencies
  current=$(cd "$dir" && shasum -a 256 package.json package-lock.json)
  installed=$(cat "$stamp" 2>/dev/null || true)
  if [ "$current" != "$installed" ]; then
    echo "Installing npm packages in $(basename "$dir")..."
    (cd "$dir" && npm ci --no-audit --no-fund)
    printf '%s\n' "$current" > "$stamp"
  fi
}

install_dependencies() {
  (cd backend && (bundle check >/dev/null 2>&1 || { echo "Installing gems..."; bundle install --jobs 4; }))
  npm_dependencies "$ROOT/frontend"
  npm_dependencies "$ROOT/collab-server"
}

# ── Processes ─────────────────────────────────────────────────────────────────

port_open() { nc -z 127.0.0.1 "$1" >/dev/null 2>&1; }
api_up() { curl -fsS --max-time 2 -o /dev/null "http://localhost:$API_PORT/up" 2>/dev/null; }

pid_file() { echo "$PID_DIR/$1.pid"; }
pid_of() { cat "$(pid_file "$1")" 2>/dev/null || true; }
alive() { [ -n "$1" ] && kill -0 "$1" 2>/dev/null; }

# Starts a command detached, in its own session, so stopping it later kills
# the whole process group (npm and the node it spawns) and never the shell,
# make or Mac app that ran this script. macOS has no setsid(1); Ruby is here anyway.
spawn() {
  local name=$1 dir=$2
  shift 2
  (cd "$dir" && exec "$RUBY" -e 'begin; Process.setsid; rescue Errno::EPERM; end; $stdin.reopen("/dev/null"); exec(*ARGV)' -- "$@") >> "$LOG_DIR/$name.log" 2>&1 &
  echo $! > "$(pid_file "$name")"
}

wait_for() {
  local what=$1 check=$2 seconds=$3 log=$4 i
  printf 'Waiting for %s' "$what"
  for ((i = 0; i < seconds; i++)); do
    if $check; then echo " ready"; return 0; fi
    printf '.'
    sleep 1
  done
  echo
  echo "$what did not answer within ${seconds}s. Last lines of $log:" >&2
  tail -n 30 "$log" >&2 || true
  return 1
}

postgres_running() { "$PG_BIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; }

start_postgres() {
  if [ ! -f "$PGDATA/PG_VERSION" ]; then
    echo "Creating the database cluster in $PGDATA..."
    "$PG_BIN/initdb" -D "$PGDATA" -U postgres --auth=trust --encoding=UTF8 --locale=en_US.UTF-8 >> "$LOG_DIR/postgres.log" 2>&1
  fi
  if postgres_running; then echo "PostgreSQL is already running on port $DB_PORT"; return 0; fi
  echo "Starting PostgreSQL on 127.0.0.1:$DB_PORT..."
  "$PG_BIN/pg_ctl" -D "$PGDATA" -l "$LOG_DIR/postgres.log" -w -t 60 \
    -o "-p $DB_PORT -k $RUN_DIR -c listen_addresses=127.0.0.1" start >> "$LOG_DIR/postgres.log" 2>&1 \
    || { tail -n 30 "$LOG_DIR/postgres.log" >&2; fail "PostgreSQL did not start (see $LOG_DIR/postgres.log)"; }
}

start_backend() {
  if api_up; then echo "The API already answers on port $API_PORT; leaving it"; return 0; fi
  (cd backend && bundle exec rails db:prepare && (bundle exec rails runner db/dev_user.rb || echo "dev user not created"))
  echo "Starting the API on port $API_PORT..."
  spawn backend "$ROOT/backend" bash -c "rm -f tmp/pids/server.pid; exec bundle exec rails server -b 127.0.0.1 -p $API_PORT"
  wait_for "the API (http://localhost:$API_PORT/up)" api_up 120 "$LOG_DIR/backend.log"
}

start_collab() {
  if port_open $COLLAB_PORT; then echo "Something already listens on port $COLLAB_PORT (the collab server?); leaving it"; return 0; fi
  echo "Starting the collab server on port $COLLAB_PORT..."
  spawn collab "$ROOT/collab-server" env PORT=$COLLAB_PORT RAILS_INTERNAL_URL="http://localhost:$API_PORT" npm run dev
  wait_for "the collab server (port $COLLAB_PORT)" "port_open $COLLAB_PORT" 60 "$LOG_DIR/collab.log"
}

start_frontend() {
  if port_open $WEB_PORT; then echo "Something already listens on port $WEB_PORT (the web app?); leaving it"; return 0; fi
  echo "Starting the web app on port $WEB_PORT..."
  spawn frontend "$ROOT/frontend" env API_URL="http://localhost:$API_PORT" COLLAB_URL="ws://localhost:$COLLAB_PORT" BYPASS_AUTH="$BYPASS_AUTH" npm run dev
  wait_for "the web app (http://localhost:$WEB_PORT)" "port_open $WEB_PORT" 180 "$LOG_DIR/frontend.log"
}

stop_process() {
  local name=$1 pid i
  pid=$(pid_of "$name")
  if alive "$pid"; then
    echo "Stopping $name (pid $pid)..."
    kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
    for ((i = 0; i < 20; i++)); do alive "$pid" || break; sleep 0.5; done
    if alive "$pid"; then kill -KILL -- "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true; fi
  fi
  rm -f -- "$(pid_file "$name")"
}

# ── Commands ──────────────────────────────────────────────────────────────────

up() {
  find_tools
  install_dependencies
  start_postgres
  start_backend
  start_collab
  start_frontend
  echo "Running without Docker: API http://localhost:$API_PORT, web http://localhost:$WEB_PORT, collab ws://localhost:$COLLAB_PORT, PostgreSQL 127.0.0.1:$DB_PORT"
  echo "Logs: make native-logs. Stop: make native-down."
}

down() {
  stop_process frontend
  stop_process collab
  stop_process backend
  if PG_BIN=$(find_postgres_bin) && [ -f "$PGDATA/postmaster.pid" ] && postgres_running; then
    echo "Stopping PostgreSQL..."
    "$PG_BIN/pg_ctl" -D "$PGDATA" -m fast -w stop >> "$LOG_DIR/postgres.log" 2>&1
  fi
  echo "Stopped"
}

running() {
  local status=0 pid name
  if PG_BIN=$(find_postgres_bin) && postgres_running; then echo "postgres   running (127.0.0.1:$DB_PORT)"; else echo "postgres   not running"; status=1; fi
  for name in backend collab frontend; do
    pid=$(pid_of "$name")
    if alive "$pid"; then printf '%-10s running (pid %s)\n' "$name" "$pid"; else printf '%-10s not running\n' "$name"; status=1; fi
  done
  if api_up; then echo "api        answering at http://localhost:$API_PORT/up"; else echo "api        not answering at http://localhost:$API_PORT/up"; status=1; fi
  [ $status = 0 ] || echo "Not running (start it with make native-up)"
  return $status
}

logs() { tail -n 20 -F "$LOG_DIR"/*.log; }

setup() { find_tools; install_dependencies; echo "✓ Ready: make native-up"; }

case "${1:-}" in
  up|down|running|logs|setup) "$1" ;;
  *) echo "Usage: $0 up|down|running|logs|setup" >&2; exit 2 ;;
esac
