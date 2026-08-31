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

### Private wedding photos

`/foto` and `/gallery` use a second Pages Function namespace at
`/api/photos/*`. Photos are compressed in the browser and uploaded directly to
a private Google Drive folder through resumable upload sessions. D1 stores only
the mapping and display metadata.

Create a separate D1 database from `cloudflare/photos-d1-schema.sql` and bind
it as `PHOTO_DB`. Configure these production and preview secrets/variables:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REFRESH_TOKEN
GOOGLE_DRIVE_FOLDER_ID
PHOTO_GALLERY_KEY_HASH
PHOTO_SESSION_SIGNING_SECRET
PHOTO_ALLOWED_ORIGINS
TURNSTILE_SECRET_KEY
NUXT_PUBLIC_TURNSTILE_SITE_KEY
```

The guest page relies on Turnstile and a short-lived signed session; it does
not require an access key. The gallery operator key is shared only in a URL
fragment; store its lowercase SHA-256 hash in Cloudflare. Never commit keys,
OAuth tokens, or QR codes.

For preview deployments, include `https://sabrotto-it.pages.dev` and
`https://*.sabrotto-it.pages.dev` in `PHOTO_ALLOWED_ORIGINS`. Adding the
hostname `sabrotto-it.pages.dev` to the Turnstile widget also authorizes its
Cloudflare-generated preview subdomains.

## Preview the production build

If you want a Nuxt-managed local preview after the build, run:

```bash
npm run preview
```

## Notes

- Production is fully static apart from the leaderboard Pages Function backed by D1.
- The `minigame/` directory contains standalone HTML/JS source files. The served copy lives in `public/minigame/`.
