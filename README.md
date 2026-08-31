# sabrotto.it

This repository contains a Nuxt 4 website.

## Prerequisites

- Node.js `^20.19.0` or `>=22.12.0`
- npm

The Node.js requirement comes from the installed Nuxt version used by this project.

## Install dependencies

From the project root, run:

```bash
npm install
```

## Run in development

Start the local development server with:

```bash
npm run dev
```

The app will be available at:

```text
http://localhost:3000
```

Nuxt will rebuild automatically when files change.

## Build for production

Create the production build with:

```bash
npm run build
```

This generates the server and public assets inside:

```text
.output/
```

## Cloudflare Pages

The production site is exported as static files and deployed with Cloudflare Pages.
Use these build settings:

```text
Build command: npm run generate
Build output directory: dist
```

The static site uses a small Pages Function for `/api/minigame/*` and a D1
database for the minigame leaderboard. Create the database from
`cloudflare/d1-schema.sql`, then bind it to the Pages project as
`MINIGAME_DB`. `public/_routes.json` ensures that only minigame API requests
invoke the Function; static asset requests remain static.

## Start the production build

After building, start the generated Node server with:

```bash
node .output/server/index.mjs
```

By default, it listens on:

```text
http://localhost:3000
```

You can override the port if needed:

```bash
PORT=4000 node .output/server/index.mjs
```

## Preview the production build

If you want a Nuxt-managed local preview after the build, run:

```bash
npm run preview
```

## Environment variables

The minigame score API uses these server-side environment variables:

- `MINIGAME_SCORE_SECRET`: HMAC secret for score-session tokens. Required in production.
- `MINIGAME_SCORE_FILE`: Override path for the score file. Defaults to `data/minigame-scores.txt`.

For deploys, put `MINIGAME_SCORE_SECRET` in `.env.deploy`. The deploy script installs it into the remote systemd service and stores scores in `/var/www/<domain>/shared/minigame-scores.txt`.

## Notes

- The current Nuxt build uses the `node-server` Nitro preset.
- The `minigame/` directory contains standalone HTML/JS source files. The served copy lives in `public/minigame/`.
