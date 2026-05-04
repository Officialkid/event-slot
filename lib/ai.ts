import prisma from './prisma'
import { askClaude } from './claude'
import { askGroq } from './groq'
import { askOpenRouter } from './openrouter'

export type AITaskType = 'insights' | 'qa' | 'capacity' | 'tracker' | 'report'

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
  const route = `AI-${taskType}`

  const runClaude = async () => askClaude({ system, prompt, maxTokens })
  const runGroq = async () => askGroq({ system, prompt, taskType, maxTokens })
  const runOpenRouter = async () => askOpenRouter({ system, prompt, taskType, maxTokens })

  if (taskType === 'report') {
    try {
      return await runClaude()
    } catch (error) {
      await logAIFailure(route, `Claude primary failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    try {
      return await runGroq()
    } catch (error) {
      await logAIFailure(route, `Groq fallback failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    try {
      return await runOpenRouter()
    } catch (error) {
      await logAIFailure(route, `OpenRouter fallback failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return null
    }
  }

  try {
    return await runGroq()
  } catch (error) {
    await logAIFailure(route, `Groq primary failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  try {
    return await runOpenRouter()
  } catch (error) {
    await logAIFailure(route, `OpenRouter fallback failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return null
  }
}
