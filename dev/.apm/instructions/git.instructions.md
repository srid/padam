# Git — append-only history

- **Never rewrite commit history.** No `git rebase`, no `git commit --amend`, no
  `git reset` that drops commits, no force-push (`git push -f`).
- Always move forward by adding **new commits** on top. History is append-only.
- Squashing/reordering, if ever wanted, is the human's call — not the agent's.
