import Groq from 'groq-sdk'

const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null

type AITaskType = 'insights' | 'qa' | 'capacity' | 'tracker' | 'report'

const TASK_MODELS: Record<AITaskType, string> = {
  insights: 'llama-3.3-70b-versatile',
  qa: 'llama-3.1-8b-instant',
  capacity: 'mixtral-8x7b-32768',
  tracker: 'llama-3.3-70b-versatile',
  report: 'llama-3.3-70b-versatile',
}

export function getGroqModelByTask(taskType: AITaskType): string {
  return TASK_MODELS[taskType] ?? TASK_MODELS.insights
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
  if (!groq) {
    throw new Error('GROQ_API_KEY is not configured')
  }

  const completion = await groq.chat.completions.create({
    model: getGroqModelByTask(taskType),
    temperature: 0.3,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
  })

  const content = completion.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('Groq returned empty response')
  }

  return content
}
