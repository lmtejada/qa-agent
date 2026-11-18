#!/usr/bin/env bash
# Claude Code PostToolUse hook: lints the TypeScript file Claude just edited under src/.
# Exit code 2 sends ESLint's output back to Claude so it fixes the violations right away.
set -uo pipefail

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"

file=$(node -e '
  let input = "";
  process.stdin.on("data", (chunk) => (input += chunk)).on("end", () => {
    const payload = JSON.parse(input);
    process.stdout.write(payload.tool_input?.file_path ?? payload.tool_response?.filePath ?? "");
  });
')

case "$file" in
  "$project_dir"/src/*.ts) ;;
  *) exit 0 ;;
esac
[ -f "$file" ] || exit 0

cd "$project_dir" || exit 0
# Use the Node version from .nvmrc, as the git hooks and CI do.
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 && nvm use --silent >/dev/null 2>&1
fi

if ! output=$(npx --no-install eslint "$file" 2>&1); then
  echo "ESLint found problems in ${file#"$project_dir"/}. Fix them before continuing:" >&2
  echo "$output" >&2
  exit 2
fi
