# Task tracker

Weekly task list. Data stays in this browser (`localStorage`). Completed tasks drop when the week rolls (Monday). Anything older than 30 days is removed.

Live at `https://dannyboy-1412.github.io/TaskTracker/` after GitHub Pages is enabled.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173/TaskTracker/`. The `/TaskTracker/` path matches GitHub Pages.

## Deploy

Pushes to `main` build and publish via `.github/workflows/deploy.yml`.

In the GitHub repo: Settings → Pages → Source → GitHub Actions.
