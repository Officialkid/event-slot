import prisma from './prisma'
import { askClaude } from './claude'
import { askGroq } from './groq'
import { askOpenRouter } from './openrouter'

export type AITaskType = 'insights' | 'qa' | 'capacity' | 'tracker' | 'report'
export type AIProviderName = 'groq' | 'openrouter' | 'claude'

export interface AIProviderStatus {
  provider: AIProviderName
  label: string
  configured: boolean
}

export interface AskAIMeta {
  content: string | null
  provider: AIProviderName | null
  attemptedProviders: AIProviderName[]
  errors: string[]
  providerStatus: AIProviderStatus[]
  retryRecommended: boolean
}

function isClaudeFallbackEnabled() {
  return process.env.AI_ENABLE_CLAUDE_FALLBACK?.trim().toLowerCase() === 'true'
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableAIError(message: string): boolean {
  const msg = message.toLowerCase()
  return (
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('econnreset') ||
    msg.includes('fetch failed') ||
    msg.includes('network') ||
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('empty response') ||
    msg.includes('5') && (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504')) ||
    msg.includes('temporarily unavailable')
  )
}

async function runWithRetries<T>(action: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await action()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown AI error')
      if (attempt >= maxAttempts || !isRetryableAIError(lastError.message)) {
        throw lastError
      }
      await delay(180 * attempt)
    }
  }

  throw lastError ?? new Error('AI request failed')
}

export function getAIProviderStatus(): AIProviderStatus[] {
  return [
    {
      provider: 'groq',
      label: 'Groq',
      configured: Boolean(process.env.GROQ_API_KEY),
    },
    {
      provider: 'openrouter',
      label: 'OpenRouter',
      configured: Boolean(process.env.OPENROUTER_API_KEY),
    },
    {
      provider: 'claude',
      label: 'Claude',
      configured: Boolean(process.env.ANTHROPIC_API_KEY),
    },
  ]
}

async function logAIFailure(route: string, message: string) {
  try {
    await prisma.errorLog.create({
      data: {
        route,
        message: message.slice(0, 1000),
      },
    })
  } catch {
    // Ignore logging failures to keep API responses resilient.
  }
}

export async function askAIWithMeta({
  system,
  prompt,
  taskType,
  maxTokens = 1200,
}: {
  system: string
  prompt: string
  taskType: AITaskType
  maxTokens?: number
}): Promise<AskAIMeta> {
  const route = `AI-${taskType}`
  const providerStatus = getAIProviderStatus()
  const attemptedProviders: AIProviderName[] = []
  const errors: string[] = []

  const runClaude = async () => askClaude({ system, prompt, maxTokens })
  const runGroq = async () => askGroq({ system, prompt, taskType, maxTokens })
  const runOpenRouter = async () => askOpenRouter({ system, prompt, taskType, maxTokens })

  const providerChain: AIProviderName[] = ['groq', 'openrouter']
  if (isClaudeFallbackEnabled()) {
    providerChain.push('claude')
  }

  const runners: Record<AIProviderName, () => Promise<string>> = {
    groq: runGroq,
    openrouter: runOpenRouter,
    claude: runClaude,
  }

  for (const provider of providerChain) {
    const status = providerStatus.find((s) => s.provider === provider)
    if (!status?.configured) {
      const msg = `${provider} not configured`
      errors.push(msg)
      await logAIFailure(route, msg)
      continue
    }

    attemptedProviders.push(provider)
    try {
      const content = await runWithRetries(runners[provider], 2)
      return {
        content,
        provider,
        attemptedProviders,
        errors,
        providerStatus,
        retryRecommended: false,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`${provider} failed: ${message}`)
      await logAIFailure(route, `${provider} failed: ${message}`)
    }
  }

  const retryRecommended = errors.some((message) => isRetryableAIError(message))
  return {
    content: null,
    provider: null,
    attemptedProviders,
    errors,
    providerStatus,
    retryRecommended,
  }
}

export async function askAI({
  system,
  prompt,
  taskType,
  maxTokens = 1200,
}: {
  system: string
  prompt: string
  taskType: AITaskType
  maxTokens?: number
}): Promise<string | null> {
  const result = await askAIWithMeta({ system, prompt, taskType, maxTokens })
  return result.content
}
