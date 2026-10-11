#!/bin/sh
# Writes the runtime config of the frontend (see frontend/app/lib/config.ts) from environment variables.
# Run by the entrypoint of the official nginx image at container startup.
set -eu

target="${STOETZMS_GRADING_POKER_CONFIG_PATH:-/usr/share/nginx/html/config.js}"

log() {
    echo "$0: $*" >&2
}

# Prints the value as a JSON string. Rejects control characters (e.g. newlines) instead of escaping them.
json_string() {
    name="$1"
    value="$2"
    stripped="$(printf '%s' "$value" | tr -d '\000-\037\177')"
    if [ "$stripped" != "$value" ]; then
        log "error: $name must not contain control characters such as newlines"
        return 1
    fi
    printf '"%s"' "$(printf '%s' "$value" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')"
}

impressum="$(json_string STOETZMS_GRADING_POKER_IMPRESSUM_URL "${STOETZMS_GRADING_POKER_IMPRESSUM_URL:-}")"
privacy="$(json_string STOETZMS_GRADING_POKER_PRIVACY_URL "${STOETZMS_GRADING_POKER_PRIVACY_URL:-}")"

printf 'window.__GRADINGPOKER_CONFIG__ = {"impressumUrl": %s, "privacyUrl": %s}\n' "$impressum" "$privacy" >"$target"

log "wrote $target"
