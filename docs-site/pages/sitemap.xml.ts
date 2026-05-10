import { promises as fs } from 'fs'
import path from 'path'
import type { NextApiRequest, NextApiResponse } from 'next'

const BASE_URL = 'https://docs.eventsslot.com'

interface Page {
  path: string
  title?: string
}

async function getAllPages(): Promise<Page[]> {
  const pagesDir = path.join(process.cwd(), 'pages')
  const pages: Page[] = []

  async function traverse(dir: string, prefix: string = ''): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      // Skip hidden files, special files, and node_modules
      if (entry.name.startsWith('_') || entry.name.startsWith('.') || entry.name === 'node_modules') {
        continue
      }

      const fullPath = path.join(dir, entry.name)
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name

      if (entry.isDirectory()) {
        await traverse(fullPath, relativePath)
      } else if (entry.name.endsWith('.mdx') || entry.name.endsWith('.md')) {
        // Remove file extension and create URL path
        const pagePath = relativePath.replace(/\.(mdx|md)$/, '')
        const url = pagePath === 'index' ? '/' : `/${pagePath.replace(/\/index$/, '')}`
        pages.push({ path: url, title: entry.name })
      } else if (entry.name.endsWith('.tsx') && entry.name !== '_app.tsx') {
        // Handle NextJS pages
        const pagePath = relativePath.replace(/\.tsx$/, '')
        const url = pagePath === 'index' ? '/' : `/${pagePath.replace(/\/index$/, '')}`
        pages.push({ path: url, title: entry.name })
      }
    }
  }

  await traverse(pagesDir)
  return pages.sort((a, b) => a.path.localeCompare(b.path))
}

export default async function handler(_req: NextApiRequest, res: NextApiResponse<string>) {
  try {
    const pages = await getAllPages()

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${pages
    .map(
      (page) => `  <url>
    <loc>${BASE_URL}${page.path}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${page.path === '/' ? '1.0' : '0.8'}</priority>
  </url>`
    )
    .join('\n')}
</urlset>`

    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.write(sitemap)
    res.end()
  } catch (error) {
    console.error('Error generating sitemap:', error)
    res.status(500).end('Error generating sitemap')
  }
}
