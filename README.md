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

This generates the static site inside:

```text
dist/
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

## Preview the production build

If you want a Nuxt-managed local preview after the build, run:

```bash
npm run preview
```

## Notes

- Production is fully static apart from the leaderboard Pages Function backed by D1.
- The `minigame/` directory contains standalone HTML/JS source files. The served copy lives in `public/minigame/`.
