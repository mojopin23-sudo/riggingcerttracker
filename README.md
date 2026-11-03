# 331 Certs

Certification board for Rig Runner, Terminal 331, Jourdanton, Texas. It tracks registration, state inspection, and annual dates on winch trucks, cranes, forklifts, tandem pole trucks, pickups, and trailers, plus the winch lines, pendant lines, slings, and chains that hang on them. Photos and PDFs stay with the record they belong to.

It is a mobile-first web app and an installable PWA. Data lives in a SQLite file. Uploads live in a folder next to it. One small server is enough.

## Run it locally

Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

The first start imports `seed/rigging_certs.xlsx` when the database is empty. Sign in with the built-in yard login:

- Name: `terminal`
- Password: `terminal331`

Change both before this is reachable outside the office. Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable | What it does |
| --- | --- |
| `APP_USER` | Shared login name. Defaults to `terminal`. |
| `APP_PASSWORD` | Shared password. Required in production. In development, unset means `terminal331`. |
| `AUTH_SECRET` | Signs the session cookie. Set a long random string in production. |
| `DATA_DIR` | Folder for `rigrunner.db` and `uploads/`. Defaults to `./data`. |
| `PORT` | Documented for hosts that read it. The npm scripts pin the app to port **43123**. |

In production the login refuses to open until `APP_PASSWORD` is set. Sessions last 30 days.

## Import a spreadsheet

```bash
npm run import -- seed/rigging_certs.xlsx
npm run import -- ./path/to/another-workbook.xlsx --replace
```

`--replace` deletes units, lines, the import log, and uploaded files, then loads the workbook. Stop the server first so SQLite is not locked.

The importer reads six tabs: Winch Trucks, Crane, Forklift, Tandem Pole Trucks, Pickups, and Trailers. A row with a unit number starts a unit. Following rows with a blank unit cell belong to that unit (lines and slings).

Dates are read as US month/day/year. A value that can be cleaned (`10/'2/2027`, `10/9/2027r`, text like `01/26/2027`) is saved as a real date and noted in the sheet log. A value that is not a real date (`9/31/2027`) is kept as text, shown on the unit, and listed under Review and Missing. `N/A` is stored as not applicable, not as missing. `SLICK BACK` becomes a note on the winch truck and does not create a fake line. Year `3031` is kept and flagged, because neighboring trailer registrations are `2031` and the sheet may be a typo. Plates written on the first tandem line row are moved onto the unit.

Open **Sheet log** in the app after an import.

## What you can do

- See what is expired, due within 30, 60, or 90 days, missing, or needing a look. Filter by equipment type and search by unit, plate, or serial.
- Add, edit, and delete units and their lines.
- Attach more than one photo or PDF to a registration, state inspection, annual, or line. On a phone, **Take photo** opens the camera.

Dates use the America/Chicago calendar, which is Terminal 331's clock.

## Deploy

The cheap path is one Node process and a persistent disk for `DATA_DIR`. Do not put the database on an ephemeral container filesystem or you will lose certificates on the next restart.

### Docker

```bash
cp .env.example .env
# edit APP_PASSWORD and AUTH_SECRET
docker compose up -d --build
```

The compose file publishes port **43123** and stores the database and uploads in a named volume. The image runs `ensure-seed` on boot, so the first start loads `seed/rigging_certs.xlsx` if the volume is empty.

The container listens on port 3000 internally. `DATA_DIR` inside the container is `/data`.

### A small VPS without Docker

```bash
npm ci
npm run build
cp .env.example .env
# set APP_PASSWORD, AUTH_SECRET, and DATA_DIR=/var/lib/331-certs
NODE_ENV=production npm start
```

Put Caddy or nginx in front for HTTPS. The service worker and the install prompt need HTTPS (localhost is the exception). Point the proxy at `127.0.0.1:43123` and keep `DATA_DIR` on the same disk across deploys.

### Phone install

In Chrome or Safari, open the site over HTTPS and use **Add to Home Screen** / **Install app**. The manifest name is **331 Certs**.

## Tests

```bash
npm test
npm run lint
```

`npm test` checks the date cleaner and imports `seed/rigging_certs.xlsx` into a throwaway database.
