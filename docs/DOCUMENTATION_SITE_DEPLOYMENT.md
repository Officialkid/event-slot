# Documentation Site Deployment Guide

## Overview

EventSlot now has a dedicated documentation site that is:
- **Publicly accessible** - No authentication required to view
- **SEO-optimized** - Discoverable by Google and other search engines
- **Separately deployed** - Runs on its own Cloud Run service for independence

## Architecture

```
docs.eventsslot.com → Google Cloud Run (eventslot-docs service)
                    → Nextra-based documentation site
                    → Sitemap + robots.txt for search engine indexing
```

## Automatic Deployment

The documentation site is automatically built and deployed as part of the CI/CD pipeline when changes are pushed to the `main` branch.

**What happens:**
1. When you push to main, GitHub Actions triggers the "EventSlot CI/CD Pipeline"
2. After tests pass, the workflow:
   - Builds the main app and deploys to `eventslot-web` Cloud Run service
   - Builds the docs-site (docs-site/) and deploys to `eventslot-docs` Cloud Run service
3. Both services are deployed simultaneously

## Accessing the Documentation Site

### Getting the Service URL

After deployment, find the docs-site Cloud Run URL:

```bash
gcloud run services describe eventslot-docs \
  --project=eventslot \
  --region=us-central1 \
  --format='value(status.url)'
```

This will return something like: `https://eventslot-docs-xxxxx-us-central1.a.run.app`

### Setting up DNS

To make documentation available at `docs.eventsslot.com`:

1. **Get the Cloud Run service URL** (from above)

2. **Create a DNS CNAME record:**
   - Provider: Your DNS provider (e.g., GoDaddy, Cloudflare, Google Domains)
   - Name: `docs`
   - Type: `CNAME`
   - Value: The Cloud Run service URL (e.g., `eventslot-docs-xxxxx-us-central1.a.run.app`)

3. **Setup Google Cloud:** 
   - If you want a custom domain on Cloud Run itself, you can also:
   ```bash
   gcloud run domain-mappings create \
     --service=eventslot-docs \
     --domain=docs.eventsslot.com \
     --region=us-central1
   ```

## SEO & Search Engine Optimization

The documentation site includes:

### Robots.txt (`/robots.txt`)
- Allows all search engines to crawl
- Points to sitemap location
- Sets appropriate crawl-delay

### Sitemap (`/sitemap.xml`)
- Dynamically generated from documentation pages
- Includes all doc sections:
  - Getting Started
  - API Reference
  - Guides
  - Developer Documentation
  - Business Features
  - Platform Integrations
  - Security Documentation
  - Technical Details
  - Appendix

### Meta Tags
- Page title: "EventSlot Documentation"
- Description: "Complete guide to smart event registration, waitlist management, and organizer tools"
- Open Graph tags for social sharing
- Canonical URL setup
- Proper charset and viewport settings

## Submitting to Google Search Console

Once DNS is configured:

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Add property: `https://docs.eventsslot.com`
3. Verify ownership (via DNS, HTML file, or Google Analytics)
4. Submit sitemap: `https://docs.eventsslot.com/sitemap.xml`
5. Monitor indexing status and Search Analytics

## Documentation Structure

The documentation is organized into:

```
docs-site/
├── pages/
│   ├── index.mdx                    (Homepage)
│   ├── getting-started/             (Quick start guides)
│   ├── guides/                      (How-to guides)
│   ├── api-reference/               (API documentation)
│   ├── developer/                   (Developer resources)
│   ├── business/                    (Business features)
│   ├── platform/                    (Platform overview)
│   ├── security/                    (Security docs)
│   ├── integrations/                (Integration guides)
│   ├── technical/                   (Technical details)
│   ├── appendix/                    (Additional info)
│   ├── sitemap.xml.ts              (Dynamic sitemap generation)
│   └── _meta.ts                    (Navigation structure)
├── public/
│   ├── robots.txt                  (Search engine instructions)
│   └── sitemap.xml                 (Placeholder - served via API route)
└── next.config.mjs                 (Next.js config with SEO headers)
```

## Updating Documentation

To add or update documentation:

1. Edit files in `docs-site/pages/`
2. Use Markdown (.md) or MDX (.mdx) format
3. Commit and push to `main` branch
4. GitHub Actions automatically rebuilds and redeploys
5. Changes live within ~5-10 minutes

## Monitoring & Maintenance

### Cloud Run Logs
```bash
gcloud run services logs read eventslot-docs \
  --project=eventslot \
  --region=us-central1 \
  --limit=50
```

### View Deployments
```bash
gcloud run revisions list \
  --service=eventslot-docs \
  --project=eventslot \
  --region=us-central1
```

### Manual Deployment (if needed)
```bash
gcloud run deploy eventslot-docs \
  --source=. \
  --dockerfile=Dockerfile.docs \
  --project=eventslot \
  --region=us-central1 \
  --allow-unauthenticated
```

## Security

The documentation site:
- ✅ Is publicly accessible (no auth required)
- ✅ Has security headers configured
- ✅ Uses HTTPS only
- ✅ Does not store sensitive data
- ✅ Is independent from the main application

## Troubleshooting

### Docs site returns 404
- Check Cloud Run service status: `gcloud run services describe eventslot-docs --project=eventslot --region=us-central1`
- Check logs: `gcloud run services logs read eventslot-docs --project=eventslot --region=us-central1`

### DNS not resolving
- Verify CNAME record is created correctly
- Wait for DNS propagation (can take 24-48 hours)
- Test with: `nslookup docs.eventsslot.com`

### Not appearing in Google search
- Submit sitemap to Google Search Console
- Wait for indexing (can take 1-2 weeks)
- Check Search Console for any crawl errors

## Next Steps

1. ✅ Deploy docs-site (automatically via CI/CD)
2. ✅ Configure robots.txt and sitemap (done)
3. → Set up DNS routing to docs.eventsslot.com
4. → Verify Google Search Console
5. → Monitor search engine indexing
6. → Add documentation link to main app navigation

