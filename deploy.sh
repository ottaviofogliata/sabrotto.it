#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_ENV_FILE="$PROJECT_ROOT/.env.deploy"

usage() {
  cat <<'USAGE'
Usage:
  ./deploy.sh [path/to/.env.deploy]

Required env vars:
  SSH_USER        SSH username, often root for first setup
  SSH_HOST        SSH host or IP address. This must be different from DOMAIN.
  DOMAIN          Public domain, used for /var/www/{domain} and nginx
  MINIGAME_SCORE_SECRET
                  Server-only HMAC secret for minigame score sessions.

Optional env vars:
  SSH_PASSWORD            SSH password. Uses sshpass when available, otherwise SSH_ASKPASS.
  SSH_KEY_PATH            SSH private key path. Used when SSH_PASSWORD is empty.
  SSH_PORT                SSH port. Default: 22.
  APP_PORT                Remote Nuxt port behind nginx. Default: 3000.
  REMOTE_APP_USER         Remote user that runs the systemd app. Default: SSH_USER.
  SERVICE_NAME            systemd service name. Default: sabrotto-{domain}.
  INCLUDE_WWW             Add www.{DOMAIN} to nginx server_name. Default: 1.
  REMOTE_INSTALL_NODE     Install Node.js 22 with NodeSource on apt hosts if missing/old. Default: 1.
  SSH_STRICT_HOST_KEY     StrictHostKeyChecking value. Default: accept-new.

Remote privilege requirement:
  SSH_USER must be root or have passwordless sudo for package install,
  systemd, nginx, and /var/www setup.

Example:
  cp .env.deploy.example .env.deploy
  chmod 600 .env.deploy
  ./deploy.sh .env.deploy
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

ENV_FILE="${1:-$DEFAULT_ENV_FILE}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  echo "Create one from .env.deploy.example, then rerun this script." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required env var: $name" >&2
    exit 1
  fi
}

require_command() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "Missing required local command: $name" >&2
    exit 1
  fi
}

escape_systemd_env_value() {
  local value="$1"
  if [[ "$value" == *$'\n'* || "$value" == *$'\r'* ]]; then
    echo "Environment values cannot contain newlines." >&2
    exit 1
  fi
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  printf '"%s"' "$value"
}

require_var SSH_USER
require_var SSH_HOST
require_var DOMAIN
require_var MINIGAME_SCORE_SECRET

SSH_PORT="${SSH_PORT:-22}"
APP_PORT="${APP_PORT:-3000}"
REMOTE_APP_USER="${REMOTE_APP_USER:-$SSH_USER}"
INCLUDE_WWW="${INCLUDE_WWW:-1}"
REMOTE_INSTALL_NODE="${REMOTE_INSTALL_NODE:-1}"
SSH_STRICT_HOST_KEY="${SSH_STRICT_HOST_KEY:-accept-new}"

if [[ ! "$DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]]; then
  echo "DOMAIN must contain only letters, numbers, dots, and hyphens." >&2
  exit 1
fi

ssh_host_lower="$(printf '%s' "$SSH_HOST" | tr '[:upper:]' '[:lower:]')"
domain_lower="$(printf '%s' "$DOMAIN" | tr '[:upper:]' '[:lower:]')"
if [[ "$ssh_host_lower" == "$domain_lower" ]]; then
  echo "SSH_HOST and DOMAIN must be different values." >&2
  exit 1
fi

if [[ ! "$SSH_PORT" =~ ^[0-9]+$ || ! "$APP_PORT" =~ ^[0-9]+$ ]]; then
  echo "SSH_PORT and APP_PORT must be numeric." >&2
  exit 1
fi

if [[ ! "$SSH_USER" =~ ^[A-Za-z0-9._-]+$ || ! "$REMOTE_APP_USER" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "SSH_USER and REMOTE_APP_USER must contain only letters, numbers, dots, underscores, and hyphens." >&2
  exit 1
fi

if [[ ${#MINIGAME_SCORE_SECRET} -lt 32 ]]; then
  echo "MINIGAME_SCORE_SECRET must be at least 32 characters. Generate one with: openssl rand -hex 32" >&2
  exit 1
fi

SERVICE_NAME="${SERVICE_NAME:-sabrotto-${DOMAIN//./-}}"
SERVICE_NAME="$(printf '%s' "$SERVICE_NAME" | tr '[:upper:]' '[:lower:]')"
if [[ ! "$SERVICE_NAME" =~ ^[a-z0-9._-]+$ ]]; then
  echo "SERVICE_NAME must contain only lowercase letters, numbers, dots, underscores, and hyphens." >&2
  exit 1
fi

require_command npm
require_command ssh
require_command scp
require_command tar

ssh_opts=(
  -p "$SSH_PORT"
  -o "StrictHostKeyChecking=$SSH_STRICT_HOST_KEY"
  -o ServerAliveInterval=30
)

scp_opts=(
  -P "$SSH_PORT"
  -o "StrictHostKeyChecking=$SSH_STRICT_HOST_KEY"
  -o ServerAliveInterval=30
)

if [[ -n "${SSH_KEY_PATH:-}" ]]; then
  ssh_opts+=(-i "$SSH_KEY_PATH")
  scp_opts+=(-i "$SSH_KEY_PATH")
fi

ssh_target="$SSH_USER@$SSH_HOST"
timestamp="$(date +%Y%m%d%H%M%S)"
archive="$(mktemp -t "${SERVICE_NAME}.XXXXXX.tar.gz")"
env_upload="$(mktemp -t "${SERVICE_NAME}.XXXXXX.env")"
askpass_helper=""
remote_archive="/tmp/${SERVICE_NAME}-${timestamp}.tar.gz"
remote_env="/tmp/${SERVICE_NAME}-${timestamp}.env"
remote_score_file="/var/www/$DOMAIN/shared/minigame-scores.txt"

cleanup() {
  rm -f "$archive"
  rm -f "$env_upload"
  if [[ -n "$askpass_helper" ]]; then
    rm -f "$askpass_helper"
  fi
  unset DEPLOY_SSH_PASSWORD
}
trap cleanup EXIT

if [[ -n "${SSH_PASSWORD:-}" ]]; then
  if command -v sshpass >/dev/null 2>&1; then
    export SSHPASS="$SSH_PASSWORD"
    ssh_cmd=(sshpass -e ssh "${ssh_opts[@]}")
    scp_cmd=(sshpass -e scp "${scp_opts[@]}")
  else
    askpass_helper="$(mktemp -t "${SERVICE_NAME}.askpass.XXXXXX")"
    cat >"$askpass_helper" <<'ASKPASS'
#!/usr/bin/env bash
printf '%s\n' "$DEPLOY_SSH_PASSWORD"
ASKPASS
    chmod 700 "$askpass_helper"
    export DEPLOY_SSH_PASSWORD="$SSH_PASSWORD"
    ssh_cmd=(env SSH_ASKPASS="$askpass_helper" SSH_ASKPASS_REQUIRE=force DISPLAY="${DISPLAY:-:0}" ssh "${ssh_opts[@]}")
    scp_cmd=(env SSH_ASKPASS="$askpass_helper" SSH_ASKPASS_REQUIRE=force DISPLAY="${DISPLAY:-:0}" scp "${scp_opts[@]}")
  fi
else
  ssh_cmd=(ssh "${ssh_opts[@]}")
  scp_cmd=(scp "${scp_opts[@]}")
fi

{
  printf 'MINIGAME_SCORE_SECRET=%s\n' "$(escape_systemd_env_value "$MINIGAME_SCORE_SECRET")"
  printf 'MINIGAME_SCORE_FILE=%s\n' "$(escape_systemd_env_value "$remote_score_file")"
} >"$env_upload"
chmod 600 "$env_upload"

echo "Installing local dependencies..."
if [[ -f "$PROJECT_ROOT/package-lock.json" ]]; then
  (cd "$PROJECT_ROOT" && npm ci)
else
  (cd "$PROJECT_ROOT" && npm install)
fi

echo "Building Nuxt production output..."
(cd "$PROJECT_ROOT" && npm run build)

if [[ -d "$PROJECT_ROOT/minigame" ]]; then
  echo "Copying minigame into .output/public/minigame..."
  rm -rf "$PROJECT_ROOT/.output/public/minigame"
  mkdir -p "$PROJECT_ROOT/.output/public/minigame"
  cp -R "$PROJECT_ROOT/minigame/." "$PROJECT_ROOT/.output/public/minigame/"
  rm -f "$PROJECT_ROOT/.output/public/minigame/AGENTS.md" "$PROJECT_ROOT/.output/public/minigame/CLAUDE.md"
  find "$PROJECT_ROOT/.output/public/minigame" -mindepth 1 -name '.*' -exec rm -rf {} +
  if [[ -f "$PROJECT_ROOT/.output/public/minigame/super.html" ]]; then
    cp "$PROJECT_ROOT/.output/public/minigame/super.html" "$PROJECT_ROOT/.output/public/minigame/SuperOtto.html"
  fi

  echo "Checking minigame JavaScript syntax..."
  for minigame_js in "$PROJECT_ROOT"/.output/public/minigame/src/*.js; do
    node --check "$minigame_js" >/dev/null
  done
  node -e '
    const path = require("node:path");
    global.window = {};
    require(path.resolve(process.argv[1], "levels.js"));
    if (!Array.isArray(window.LEVELS) || window.LEVELS.length === 0) {
      throw new Error("levels.js did not populate window.LEVELS");
    }
  ' "$PROJECT_ROOT/.output/public/minigame/src"
fi

echo "Packaging .output..."
tar_extra=()
tar_probe="$(mktemp -t "${SERVICE_NAME}.tar-probe.XXXXXX")"
if tar --no-xattrs -cf "$tar_probe" --files-from /dev/null >/dev/null 2>&1; then
  tar_extra+=(--no-xattrs)
fi
if tar --disable-copyfile -cf "$tar_probe" --files-from /dev/null >/dev/null 2>&1; then
  tar_extra+=(--disable-copyfile)
fi
rm -f "$tar_probe"
COPYFILE_DISABLE=1 tar "${tar_extra[@]}" -C "$PROJECT_ROOT" -czf "$archive" .output

echo "Uploading release to $ssh_target:$remote_archive..."
"${scp_cmd[@]}" "$archive" "$ssh_target:$remote_archive"
echo "Uploading server runtime environment to $ssh_target:$remote_env..."
"${scp_cmd[@]}" "$env_upload" "$ssh_target:$remote_env"

echo "Configuring remote host..."
"${ssh_cmd[@]}" "$ssh_target" \
  "bash -s -- '$DOMAIN' '$APP_PORT' '$remote_archive' '$SERVICE_NAME' '$REMOTE_APP_USER' '$INCLUDE_WWW' '$REMOTE_INSTALL_NODE' '$remote_env'" <<'REMOTE_SCRIPT'
set -Eeuo pipefail

DOMAIN="$1"
APP_PORT="$2"
REMOTE_ARCHIVE="$3"
SERVICE_NAME="$4"
REMOTE_APP_USER="$5"
INCLUDE_WWW="$6"
REMOTE_INSTALL_NODE="$7"
REMOTE_ENV_FILE="$8"

APP_ROOT="/var/www/$DOMAIN"
RELEASES_DIR="$APP_ROOT/releases"
RELEASE_DIR="$RELEASES_DIR/$(date +%Y%m%d%H%M%S)"
CURRENT_LINK="$APP_ROOT/current"
SHARED_DIR="$APP_ROOT/shared"
ENV_FILE="$SHARED_DIR/app.env"
SCORE_FILE="$SHARED_DIR/minigame-scores.txt"

if [[ "$(id -u)" -eq 0 ]]; then
  as_root=()
elif command -v sudo >/dev/null 2>&1; then
  as_root=(sudo -n)
else
  echo "Remote user is not root and sudo is not installed." >&2
  exit 1
fi

run_root() {
  "${as_root[@]}" "$@"
}

install_nginx() {
  if command -v nginx >/dev/null 2>&1; then
    return
  fi

  echo "Installing nginx..."
  if command -v apt-get >/dev/null 2>&1; then
    run_root apt-get update
    run_root env DEBIAN_FRONTEND=noninteractive apt-get install -y nginx
  elif command -v dnf >/dev/null 2>&1; then
    run_root dnf install -y nginx
  elif command -v yum >/dev/null 2>&1; then
    run_root yum install -y nginx
  else
    echo "Cannot install nginx automatically on this OS. Install nginx, then rerun." >&2
    exit 1
  fi
}

node_is_compatible() {
  command -v node >/dev/null 2>&1 && node -e '
    const [major, minor] = process.versions.node.split(".").map(Number);
    process.exit((major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major > 22 ? 0 : 1);
  ' >/dev/null 2>&1
}

install_node() {
  if node_is_compatible; then
    return
  fi

  if [[ "$REMOTE_INSTALL_NODE" != "1" ]]; then
    echo "Node.js ^20.19.0 or >=22.12.0 is required on the remote host." >&2
    exit 1
  fi

  if ! command -v apt-get >/dev/null 2>&1; then
    echo "Automatic Node.js install is only supported on apt-based hosts." >&2
    echo "Install Node.js ^20.19.0 or >=22.12.0, then rerun." >&2
    exit 1
  fi

  echo "Installing Node.js 22..."
  run_root apt-get update
  run_root env DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl gnupg
  curl -fsSL https://deb.nodesource.com/setup_22.x | run_root bash -
  run_root env DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs

  if ! node_is_compatible; then
    echo "Installed Node.js is still not compatible with this Nuxt build." >&2
    node --version >&2 || true
    exit 1
  fi
}

install_nginx
install_node

NODE_BIN="$(command -v node)"
OPENSSL_BIN="$(command -v openssl || true)"

echo "Installing release in $RELEASE_DIR..."
run_root mkdir -p "$RELEASE_DIR"
run_root tar -xzf "$REMOTE_ARCHIVE" -C "$RELEASE_DIR"
run_root rm -f "$REMOTE_ARCHIVE"
run_root chown -R "$REMOTE_APP_USER" "$APP_ROOT"
run_root ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"

echo "Installing server runtime environment..."
run_root mkdir -p "$SHARED_DIR"
run_root touch "$SCORE_FILE"
run_root chown "$REMOTE_APP_USER" "$SHARED_DIR" "$SCORE_FILE"
run_root chmod 750 "$SHARED_DIR"
run_root chmod 640 "$SCORE_FILE"
run_root install -m 0600 "$REMOTE_ENV_FILE" "$ENV_FILE"
run_root rm -f "$REMOTE_ENV_FILE"

tmp_service="$(mktemp)"
cat >"$tmp_service" <<SERVICE
[Unit]
Description=Nuxt app for $DOMAIN
After=network.target

[Service]
Type=simple
User=$REMOTE_APP_USER
WorkingDirectory=$CURRENT_LINK
Environment=HOST=127.0.0.1
Environment=PORT=$APP_PORT
Environment=NODE_ENV=production
EnvironmentFile=$ENV_FILE
ExecStart=$NODE_BIN $CURRENT_LINK/.output/server/index.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE

run_root install -m 0644 "$tmp_service" "/etc/systemd/system/$SERVICE_NAME.service"
rm -f "$tmp_service"

server_names="$DOMAIN"
ssl_names="DNS:$DOMAIN"
if [[ "$INCLUDE_WWW" == "1" ]]; then
  server_names="$DOMAIN www.$DOMAIN"
  ssl_names="$ssl_names,DNS:www.$DOMAIN"
fi

SSL_DIR="/etc/nginx/ssl/$DOMAIN"
SSL_CERT="$SSL_DIR/origin.crt"
SSL_KEY="$SSL_DIR/origin.key"
if [[ ! -f "$SSL_CERT" || ! -f "$SSL_KEY" ]]; then
  if [[ -z "$OPENSSL_BIN" ]]; then
    if command -v apt-get >/dev/null 2>&1; then
      run_root apt-get update
      run_root env DEBIAN_FRONTEND=noninteractive apt-get install -y openssl
    elif command -v dnf >/dev/null 2>&1; then
      run_root dnf install -y openssl
    elif command -v yum >/dev/null 2>&1; then
      run_root yum install -y openssl
    else
      echo "openssl is required to create the origin HTTPS certificate." >&2
      exit 1
    fi
    OPENSSL_BIN="$(command -v openssl)"
  fi

  run_root mkdir -p "$SSL_DIR"
  run_root "$OPENSSL_BIN" req -x509 -nodes -newkey rsa:2048 -days 3650 \
    -keyout "$SSL_KEY" \
    -out "$SSL_CERT" \
    -subj "/CN=$DOMAIN" \
    -addext "subjectAltName=$ssl_names"
  run_root chmod 600 "$SSL_KEY"
fi

tmp_nginx="$(mktemp)"
cat >"$tmp_nginx" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $server_names;

    location / {
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_pass http://127.0.0.1:$APP_PORT;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $server_names;

    ssl_certificate $SSL_CERT;
    ssl_certificate_key $SSL_KEY;

    location / {
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_pass http://127.0.0.1:$APP_PORT;
    }
}
NGINX

if [[ -d /etc/nginx/sites-available && -d /etc/nginx/sites-enabled ]]; then
  run_root install -m 0644 "$tmp_nginx" "/etc/nginx/sites-available/$DOMAIN"
  run_root ln -sfn "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"
  run_root rm -f /etc/nginx/sites-enabled/default
else
  run_root mkdir -p /etc/nginx/conf.d
  run_root install -m 0644 "$tmp_nginx" "/etc/nginx/conf.d/$DOMAIN.conf"
fi
rm -f "$tmp_nginx"

run_root nginx -t
run_root systemctl daemon-reload
run_root systemctl enable "$SERVICE_NAME"
run_root systemctl restart "$SERVICE_NAME"
run_root systemctl enable nginx
run_root systemctl reload nginx || run_root systemctl restart nginx

sleep 2
if ! node -e '
  fetch(`http://127.0.0.1:${process.argv[1]}/`, { headers: { Host: process.argv[2] } })
    .then((res) => process.exit(res.ok ? 0 : 1))
    .catch(() => process.exit(1));
' "$APP_PORT" "$DOMAIN"; then
  echo "The app did not respond on 127.0.0.1:$APP_PORT." >&2
  run_root journalctl -u "$SERVICE_NAME" -n 80 --no-pager >&2 || true
  exit 1
fi

if ! node -e '
  fetch(`http://127.0.0.1/`, { headers: { Host: process.argv[1] } })
    .then((res) => process.exit(res.ok ? 0 : 1))
    .catch(() => process.exit(1));
' "$DOMAIN"; then
  echo "nginx did not serve the app on port 80." >&2
  exit 1
fi

if ! node -e '
  const https = require("node:https");
  const req = https.get({
    hostname: "127.0.0.1",
    port: 443,
    path: "/",
    headers: { Host: process.argv[1] },
    rejectUnauthorized: false,
  }, (res) => process.exit(res.statusCode >= 200 && res.statusCode < 400 ? 0 : 1));
  req.on("error", () => process.exit(1));
' "$DOMAIN"; then
  echo "nginx did not serve the app on port 443." >&2
  exit 1
fi

echo "Deployment complete: https://$DOMAIN"
REMOTE_SCRIPT

echo "Done. Deployed $DOMAIN via systemd service $SERVICE_NAME."
