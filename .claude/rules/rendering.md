# Rendering — pu box only

- **Never render locally.** Headless-Chromium rendering + encode is expensive and
  NixOS-fiddly. Always render on a pre-created pu box.
- Use `just render <name>` (defaults to the pu host `padam`) — it syncs, renders on
  the box, and copies the MP4 back. Override the host with `just render <name> <host>`.
- If the pu box doesn't exist yet, create it first; do not fall back to a local render.
- `src/render.ts` is the renderer that runs *on* the box — don't invoke it on this machine.
