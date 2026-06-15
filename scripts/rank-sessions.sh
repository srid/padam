#!/usr/bin/env bash
# Rank local Claude Code sessions by file-edit density — helps pick one to feature.
# Usage: scripts/rank-sessions.sh [project-substring]
set -euo pipefail
ROOT="$HOME/.claude/projects"
FILTER="${1:-}"
cd "$ROOT"

# Mid-sized sessions (rich but parseable), excluding subagent/workflow side-logs.
mapfile -t files < <(find . -name '*.jsonl' -size +250k -size -2200k \
  ! -path '*/subagents/*' ! -path '*/workflows/*' -printf '%s\t%p\n' 2>/dev/null \
  | sort -rn | head -150 | cut -f2)

printf "%-6s %-6s %-7s  %s\n" "EDITS" "WRITE" "PATCH" "SESSION"
for f in "${files[@]}"; do
  [ -n "$FILTER" ] && [[ "$f" != *"$FILTER"* ]] && continue
  e=$(grep -c '"name":"Edit"' "$f" 2>/dev/null || echo 0)
  w=$(grep -c '"name":"Write"' "$f" 2>/dev/null || echo 0)
  p=$(grep -c '"structuredPatch"' "$f" 2>/dev/null || echo 0)
  [ $((e + w)) -ge 3 ] && printf "%-6s %-6s %-7s  %s\n" "$e" "$w" "$p" "$f"
done | sort -k3 -rn | head -25
