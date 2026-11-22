# موج for Windows

Fork of Nuvio Astra (Rust + Tauri 2 + React, GPL-3.0), being turned into «موج» for Windows.
Frontend: `apps/nuvio-desktop/web` (Vite + React). Backend: `apps/nuvio-desktop/src` and `crates/`.

## Rules

- **App texts** are in formal Arabic (فصحى), impersonal voice, never gendered, no personal names.
- **The app name is «موج»**, never «الموج».
- **Never commit** keys or secrets, `local.properties`, `node_modules`, `dist` or `target`.
- **After each finished step**, commit and push to the fork (`origin`) so nothing is lost.
  - Every commit message ends with `[skip ci]`: a push to `main` otherwise runs
    `.github/workflows/release.yml`, which publishes a public release. Releases are started by hand.

## Run

```powershell
cd apps\nuvio-desktop\web; npm ci; npm run build; cd ..\..\..
cargo run -p nuvio-desktop
```

There is no `devUrl`: the app loads `web/dist`, so rebuild the web UI after each UI change.
