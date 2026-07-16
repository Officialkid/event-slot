#!/usr/bin/env node

const argBaseUrl = process.argv
  .slice(2)
  .find((arg) => arg.startsWith("--base-url="))
  ?.split("=")[1]

const baseUrlRaw = argBaseUrl || process.env.CLOUD_RUN_URL || process.env.BASE_URL

if (!baseUrlRaw) {
  console.error("[smoke] Missing base URL. Provide --base-url=<url> or CLOUD_RUN_URL env var.")
  process.exit(1)
}

const baseUrl = baseUrlRaw.replace(/\/+$/, "")
const identityToken = process.env.CLOUD_RUN_ID_TOKEN

async function readText(res) {
  return await res.text()
}

function assertIncludes(body, expected, label) {
  if (!body.includes(expected)) {
    throw new Error(`Expected ${label} to include '${expected}'`)
  }
}

function assertNotIncludes(body, unexpected, label) {
  if (body.includes(unexpected)) {
    throw new Error(`Expected ${label} not to include '${unexpected}'`)
  }
}

function extractScriptSources(html) {
  return [...html.matchAll(/<script[^>]+src="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((src) => src.startsWith("/_next/static/"))
}

async function fetchAssetText(src) {
  const response = await fetch(`${baseUrl}${src}`, {
    headers: {
      "user-agent": "eventslot-cloudrun-smoke-tests/1.0",
      ...(identityToken ? { authorization: `Bearer ${identityToken}` } : {}),
    },
  })
  if (!response.ok) return ""
  return await response.text()
}

async function readPageAndChunks(html) {
  const scripts = extractScriptSources(html)
  const chunks = await Promise.all(scripts.map((src) => fetchAssetText(src)))
  return [html, ...chunks].join("\n")
}

const TESTS = [
  {
    name: "Homepage returns 200",
    path: "/",
    validate: async (res) => {
      if (res.status !== 200) {
        throw new Error(`Expected status 200, got ${res.status}`)
      }
      const body = await readText(res)
      assertNotIncludes(body, "collect payments", "homepage")
      assertNotIncludes(body, "Paid ticketing", "homepage")
    },
  },
  {
    name: "Sign-in page returns 200",
    path: "/signin",
    validate: async (res) => {
      if (res.status !== 200) {
        throw new Error(`Expected status 200, got ${res.status}`)
      }
      const body = await readText(res)
      const searchable = await readPageAndChunks(body)
      assertIncludes(searchable, "Terms", "sign-in page bundle")
      assertIncludes(searchable, "Privacy", "sign-in page bundle")
      assertIncludes(searchable, "Google", "sign-in page bundle")
      assertIncludes(searchable, "Please agree to the Terms and Privacy Policy", "sign-in page bundle")
    },
  },
  {
    name: "Sign-up page returns 200",
    path: "/signup",
    validate: async (res) => {
      if (res.status !== 200) {
        throw new Error(`Expected status 200, got ${res.status}`)
      }
      const body = await readText(res)
      const searchable = await readPageAndChunks(body)
      assertIncludes(searchable, "Terms", "sign-up page bundle")
      assertIncludes(searchable, "Privacy", "sign-up page bundle")
      assertIncludes(searchable, "Google", "sign-up page bundle")
      assertIncludes(searchable, "Please agree to the Terms and Privacy Policy", "sign-up page bundle")
    },
  },
  {
    name: "Credits purchase endpoint is paused",
    path: "/api/billing/credits",
    method: "POST",
    body: "{}",
    validate: async (res) => {
      if (res.status !== 503) {
        throw new Error(`Expected status 503, got ${res.status}`)
      }
      const body = await readText(res)
      assertIncludes(body, "coming soon", "credits endpoint response")
    },
  },
  {
    name: "Report purchase endpoint is paused",
    path: "/api/billing/report-downloads",
    method: "POST",
    body: "{}",
    validate: async (res) => {
      if (res.status !== 503) {
        throw new Error(`Expected status 503, got ${res.status}`)
      }
      const body = await readText(res)
      assertIncludes(body, "coming soon", "report-download endpoint response")
    },
  },
  {
    name: "robots.txt returns valid content",
    path: "/robots.txt",
    validate: async (res) => {
      if (res.status !== 200) {
        throw new Error(`Expected status 200, got ${res.status}`)
      }
      const body = await res.text()
      if (!body.toLowerCase().includes("user-agent:")) {
        throw new Error("robots.txt does not include 'User-agent:'")
      }
    },
  },
  {
    name: "sitemap.xml returns XML",
    path: "/sitemap.xml",
    validate: async (res) => {
      if (res.status !== 200) {
        throw new Error(`Expected status 200, got ${res.status}`)
      }
      const contentType = res.headers.get("content-type") || ""
      if (!contentType.toLowerCase().includes("xml")) {
        throw new Error(`Expected XML content-type, got '${contentType}'`)
      }
    },
  },
]

async function runTest(test) {
  const url = `${baseUrl}${test.path}`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(url, {
      method: test.method || "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "eventslot-cloudrun-smoke-tests/1.0",
        ...(test.body ? { "content-type": "application/json" } : {}),
        ...(identityToken ? { authorization: `Bearer ${identityToken}` } : {}),
      },
      ...(test.body ? { body: test.body } : {}),
    })

    await test.validate(response)
    console.log(`PASS - ${test.name} (${url})`)
    return true
  } catch (error) {
    console.error(`FAIL - ${test.name} (${url})`)
    console.error(`       ${error instanceof Error ? error.message : String(error)}`)
    return false
  } finally {
    clearTimeout(timeoutId)
  }
}

async function main() {
  console.log(`[smoke] Running ${TESTS.length} Cloud Run smoke tests against ${baseUrl}`)
  if (identityToken) {
    console.log("[smoke] Using CLOUD_RUN_ID_TOKEN for authenticated requests")
  }

  let passed = 0
  for (const test of TESTS) {
    // Run in sequence for easier debugging in CI logs.
    if (await runTest(test)) passed += 1
  }

  console.log(`[smoke] ${passed}/${TESTS.length} tests passed`)
  if (passed !== TESTS.length) {
    if (!identityToken) {
      console.error("[smoke] Tip: for private Cloud Run services, set CLOUD_RUN_ID_TOKEN.")
    }
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(`[smoke] Unexpected failure: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
