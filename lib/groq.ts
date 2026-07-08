import Groq from 'groq-sdk'

if (!process.env.GROQ_API_KEY) {
  console.warn('[EventSlot] GROQ_API_KEY not set — AI assistant disabled')
}

export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY ?? '',
})

// Keep defaults aligned with Groq's current replacement guidance.
export const ASSISTANT_MODEL = 'openai/gpt-oss-20b'
export const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'
export const VISION_MODEL_FALLBACK = 'meta-llama/llama-4-maverick-17b-128e-instruct'

// Keep internal client reference for askGroq helper (null-safe legacy usage)
const _groq = process.env.GROQ_API_KEY ? groq : null

type AITaskType = 'insights' | 'qa' | 'capacity' | 'tracker' | 'report'

const TASK_MODELS: Record<AITaskType, string[]> = {
  insights: ['openai/gpt-oss-120b', 'qwen/qwen3.6-27b'],
  qa: ['openai/gpt-oss-20b', 'openai/gpt-oss-120b'],
  capacity: ['openai/gpt-oss-20b', 'openai/gpt-oss-120b'],
  tracker: ['openai/gpt-oss-120b', 'qwen/qwen3.6-27b'],
  report: ['openai/gpt-oss-120b', 'qwen/qwen3.6-27b'],
}

export function getGroqModelByTask(taskType: AITaskType): string {
  return (TASK_MODELS[taskType] ?? TASK_MODELS.insights)[0]
}

export async function askGroq({
  system,
  prompt,
  taskType,
  maxTokens = 1200,
}: {
  system: string
  prompt: string
  taskType: AITaskType
  maxTokens?: number
}): Promise<string> {
  if (!_groq) {
    throw new Error('GROQ_API_KEY is not configured')
  }

  const models = TASK_MODELS[taskType] ?? TASK_MODELS.insights
  let lastError: Error | null = null

  for (const model of models) {
    try {
      const completion = await _groq.chat.completions.create({
        model,
        temperature: 0.3,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      })

      const content = completion.choices?.[0]?.message?.content
      if (!content) {
        throw new Error(`Groq model ${model} returned empty response`)
      }

      return content
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(`Groq model ${model} failed`)
    }
  }

  throw lastError ?? new Error('Groq returned empty response')
}
