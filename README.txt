BILL, PLEASE
Release: 2026-11-26
Live: https://bill-please.netlify.app/
Repository: https://github.com/Katsys7/bill-please

The frontend is in site/. It is ordinary HTML, CSS and JavaScript.
A small Netlify Function stores completed bills and makes short /b/ID links.
No paid service, AI API, custom domain or separate storage account is needed.
Keep Netlify on Free; its included hosting credits have a hard cap.

PREVIEW / TEST
UI preview: python3 tools/serve.py (Windows: py tools/serve.py).
Open http://127.0.0.1:4173/. Python preview does not run the share-link backend.
Full local backend preview requires Node 22+, npm ci, and Netlify CLI dev.
Offline API tests: npm ci, then npm test.
The @netlify/blobs dependency is pinned in package-lock.json. Netlify installs
it automatically when deploying from the repository. No build command needed.

MAINTENANCE
Start any new coding assistant with AGENTS.md and AI-HANDOFF.txt.
Keep publish directory site; keep main connected in Netlify. New commits to main
automatically deploy when automatic publishing is enabled.
Completed bills used for short links are stored in Netlify Blobs. Draft edits
stay in the browser. Old long share links continue working.
Do not delete or rename the bill-please-shared-v1 store: existing short links
depend on it. Save the code in GitHub and keep a separate ZIP backup.
figma-ready/ was intentionally not updated for this release.
Vercel's static configuration does not implement the Netlify short-link backend.
