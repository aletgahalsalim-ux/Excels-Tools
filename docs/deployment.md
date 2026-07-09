# دليل النشر — Deployment Guide

## 1. Web platform (production)

The whole stack ships as containers. Any Docker host works (VPS from Hetzner/DigitalOcean/AWS Lightsail, or a managed container service).

### One-host deployment (recommended start)

```bash
git clone <repo> && cd Excels-Tools
cp .env.example .env
# fill in: JWT_SECRET (long random), POSTGRES_PASSWORD, S3_SECRET_KEY,
#          ANTHROPIC_API_KEY, API_PUBLIC_URL, WEB_ORIGIN, OAuth keys (optional)
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec api npx ts-node --transpile-only prisma/seed.ts   # first run only
```

Services: `web:3000`, `api:3001`, plus internal postgres/redis/minio/excel-analyzer.

### TLS / domains

Put a reverse proxy in front (example with [Caddy](https://caddyserver.com) — automatic HTTPS):

```
app.your-domain.com {
    reverse_proxy localhost:3000
}
api.your-domain.com {
    reverse_proxy localhost:3001
}
```

Then set in `.env`: `WEB_ORIGIN=https://app.your-domain.com`, `API_PUBLIC_URL=https://api.your-domain.com`, and rebuild `web` (the API URL is baked at build time).

### OAuth redirect URIs (production)

| Provider | Redirect URI to register |
|---|---|
| Google | `https://api.your-domain.com/api/v1/auth/oauth/google/callback` |
| Microsoft | `https://api.your-domain.com/api/v1/auth/oauth/microsoft/callback` |
| Apple | `https://api.your-domain.com/api/v1/auth/oauth/apple/callback` (HTTPS required) |

### Managed alternative (no VPS)

- **Web** → Vercel (root `apps/web`, env `NEXT_PUBLIC_API_URL`)
- **API + analyzer** → Railway/Render/Fly.io using the same Dockerfiles
- **Postgres/Redis** → the platform's managed add-ons; **storage** → any S3 bucket (`STORAGE_DRIVER=s3`)

## 2. Mobile apps (Android + iOS)

`apps/mobile` is an [Expo](https://expo.dev) app sharing `@afdip/shared` types and the same REST API.

### Run instantly on your phone (no store, no build)

```bash
cd apps/mobile
npm run start          # shows a QR code
```

Install the **Expo Go** app (App Store / Play Store), scan the QR — the app runs on your device against the API URL in `app.json → extra.apiUrl` (set it to your machine's LAN IP or the production API).

### Store builds (EAS)

Requires a free [Expo account](https://expo.dev/signup); store publishing requires a Google Play developer account ($25 one-time) and/or Apple Developer Program ($99/yr).

```bash
npm i -g eas-cli && eas login
cd apps/mobile
# set the production API URL in eas.json (EXPO_PUBLIC_API_URL)
eas build -p android --profile production    # produces .aab for Play Store
eas build -p ios --profile production        # produces .ipa for App Store
eas submit -p android                        # upload to Play Console
eas submit -p ios                            # upload to App Store Connect
```

For sideload testing without stores: `eas build -p android --profile preview` produces an installable `.apk`.

### Social login on mobile

The app opens the provider in a secure browser session and the API redirects back to the `afdip://auth` deep link (`?client=mobile` flow). No extra mobile SDK keys needed — the same server-side OAuth credentials work, but add the redirect URIs above and (for Google) consider an additional OAuth client of type "Web application" pointed at the same callback.

## 3. Environment variables checklist (production)

| Var | Notes |
|---|---|
| `JWT_SECRET` | long random string — rotate = all sessions invalidated |
| `POSTGRES_PASSWORD`, `S3_SECRET_KEY` | strong secrets |
| `ANTHROPIC_API_KEY`, `AI_PROVIDER=anthropic` | real agent runs |
| `API_PUBLIC_URL`, `WEB_ORIGIN` | public HTTPS URLs |
| `GOOGLE_/MICROSOFT_/APPLE_*` | optional — provider buttons appear automatically |
