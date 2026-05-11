# EventSlot Documentation Site

Official documentation portal for EventSlot, built with Next.js 14 and Nextra 3.

## Stack

- Next.js 14
- Nextra 3 + Nextra Docs Theme
- TypeScript
- Tailwind CSS
- Lucide React

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Build

```bash
npm run build
npm start
```

Build command: `npm run build`

Output directory: `.next`

## Environment Variables

Use `.env.example` as the template for local configuration.

```bash
cp .env.example .env.local
```

Current variables:

- `NEXT_PUBLIC_SITE_URL` - public docs URL used in metadata and canonical references

## Deployment

Built and deployed via Docker using `Dockerfile.docs` at the repo root. The image is pushed to Google Artifact Registry and served on Google Cloud Run.

```bash
docker build -f Dockerfile.docs -t eventslot-docs .
```

Custom domain: `docs.eventsslot.com`
