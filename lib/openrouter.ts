import { APP_URL } from '@/lib/config'

type AITaskType = 'insights' | 'qa' | 'capacity' | 'tracker' | 'report'

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

const TASK_MODELS: Record<AITaskType, string> = {
  insights: 'meta-llama/llama-3.1-8b-instruct',
  qa: 'meta-llama/llama-3.1-8b-instruct',
  capacity: 'mistralai/mistral-7b-instruct',
  tracker: 'meta-llama/llama-3.1-8b-instruct',
  report: 'meta-llama/llama-3.1-8b-instruct',
}

function getOpenRouterModelByTask(taskType: AITaskType): string {
  return TASK_MODELS[taskType] ?? TASK_MODELS.insights
}

export async function askOpenRouter({
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
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not configured')
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': APP_URL,
      'X-Title': 'EventSlot',
    },
    body: JSON.stringify({
      model: getOpenRouterModelByTask(taskType),
      max_tokens: maxTokens,
      temperature: 0.3,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenRouter error: ${error}`)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('OpenRouter returned empty response')
  }

  return content
}
