#!/usr/bin/env node

const DEFAULT_BASE_URL = "http://localhost:3000"

function showHelp() {
  console.log(`
EventSlot registration load-test helper

Usage:
  node scripts/load-test-registration.mjs --event-slug=<slug> --payload-file=<file> --run

Options:
  --base-url=<url>          Target app URL. Defaults to ${DEFAULT_BASE_URL}
  --event-slug=<slug>       Public event slug to test.
  --payload-file=<file>     JSON body template for POST /api/register.
  --duration=<seconds>      Test duration. Defaults to 60.
  --rps=<number>            Target requests per second. Defaults to 1.
  --mode=<all|page|draft|register>
                            Endpoint mix to run. Defaults to all.
  --run                     Actually send traffic. Without this, the script dry-runs.

Safety:
  Production targets require ALLOW_PRODUCTION_LOAD_TEST=true.
  Use a dedicated test event, test questions, and synthetic emails only.
`)
}

function getArg(name, fallback = "") {
  const prefix = `--${name}=`
  const value = process.argv.find((arg) => arg.startsWith(prefix))
  return value ? value.slice(prefix.length) : fallback
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`)
}

function isProductionLike(url) {
  return /eventsslot\.com|\.run\.app/i.test(url)
}

function makeEmail(index) {
  return `load-test-${Date.now()}-${index}@example.test`
}

async function readPayloadTemplate(path) {
  if (!path) return null
  const { readFile } = await import("node:fs/promises")
  return JSON.parse(await readFile(path, "utf8"))
}

function clonePayload(template, eventSlug, index) {
  const email = makeEmail(index)
  const payload = JSON.parse(JSON.stringify(template ?? {}))
  payload.eventSlug = eventSlug
  payload.consentDataProcessing = true
  payload.consentTransactional = true
  payload.sendResponseCopy = false
  payload.forceDuplicate = true
  payload.source = "load-test"
  payload.attendees = Array.isArray(payload.attendees) && payload.attendees.length > 0
    ? payload.attendees
    : [{ answers: [] }]

  payload.attendees = payload.attendees.map((attendee) => {
    const next = { ...attendee }
    next.baseEmail = email
    next.answers = Array.isArray(next.answers) ? next.answers : []
    next.answers = next.answers.map((answer) => {
      if (/email/i.test(String(answer.questionId)) || /email/i.test(String(answer.label ?? ""))) {
        return { ...answer, value: email }
      }
      return answer
    })
    return next
  })

  return { email, payload }
}

async function requestJson(url, init = {}) {
  const startedAt = performance.now()
  const response = await fetch(url, init)
  const elapsedMs = performance.now() - startedAt
  const text = await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text.slice(0, 180)
  }
  return { ok: response.ok, status: response.status, elapsedMs, body }
}

function summarize(results) {
  const latencies = results.map((result) => result.elapsedMs).sort((a, b) => a - b)
  const percentile = (p) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))] ?? 0
  const errors = results.filter((result) => !result.ok)
  return {
    total: results.length,
    ok: results.length - errors.length,
    errors: errors.length,
    p50: Math.round(percentile(0.5)),
    p95: Math.round(percentile(0.95)),
    p99: Math.round(percentile(0.99)),
    statuses: results.reduce((acc, result) => {
      acc[result.status] = (acc[result.status] ?? 0) + 1
      return acc
    }, {}),
    sampleErrors: errors.slice(0, 5).map((result) => ({ status: result.status, body: result.body })),
  }
}

async function run() {
  if (hasFlag("help") || hasFlag("h")) {
    showHelp()
    return
  }

  const baseUrl = getArg("base-url", process.env.LOAD_TEST_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "")
  const eventSlug = getArg("event-slug", process.env.LOAD_TEST_EVENT_SLUG || "")
  const payloadFile = getArg("payload-file", process.env.LOAD_TEST_PAYLOAD_FILE || "")
  const durationSeconds = Math.max(1, Number(getArg("duration", process.env.LOAD_TEST_DURATION_SECONDS || "60")))
  const rps = Math.max(0.1, Number(getArg("rps", process.env.LOAD_TEST_RPS || "1")))
  const mode = getArg("mode", process.env.LOAD_TEST_MODE || "all")
  const shouldRun = hasFlag("run")

  if (!eventSlug) {
    console.error("Missing --event-slug=<slug>.")
    process.exitCode = 1
    return
  }

  if (isProductionLike(baseUrl) && process.env.ALLOW_PRODUCTION_LOAD_TEST !== "true") {
    console.error("Refusing to run against production-like URL without ALLOW_PRODUCTION_LOAD_TEST=true.")
    process.exitCode = 1
    return
  }

  const template = await readPayloadTemplate(payloadFile)
  const totalRequests = Math.ceil(durationSeconds * rps)
  const intervalMs = 1000 / rps

  console.log(JSON.stringify({
    baseUrl,
    eventSlug,
    mode,
    durationSeconds,
    rps,
    totalRequests,
    dryRun: !shouldRun,
    payloadFile: payloadFile || null,
  }, null, 2))

  if (!shouldRun) {
    console.log("Dry run only. Add --run to send traffic.")
    return
  }

  const results = []
  const tasks = []

  for (let index = 0; index < totalRequests; index += 1) {
    tasks.push(new Promise((resolve) => setTimeout(resolve, Math.round(index * intervalMs))).then(async () => {
      const { email, payload } = clonePayload(template, eventSlug, index)
      const endpointMode = mode === "all" ? ["page", "draft", "register"][index % 3] : mode

      if (endpointMode === "page") {
        results.push(await requestJson(`${baseUrl}/${encodeURIComponent(eventSlug)}`))
        return
      }

      if (endpointMode === "draft") {
        results.push(await requestJson(`${baseUrl}/api/register/draft`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventSlug,
            email,
            answers: payload.attendees[0]?.answers ?? [],
            attendeeCount: 1,
            baseEmails: [email],
            consentDataProcessing: true,
            consentTransactional: true,
          }),
        }))
        return
      }

      if (endpointMode === "register") {
        results.push(await requestJson(`${baseUrl}/api/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }))
        return
      }

      throw new Error(`Unknown mode: ${endpointMode}`)
    }))
  }

  await Promise.all(tasks)
  console.log(JSON.stringify(summarize(results), null, 2))
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
