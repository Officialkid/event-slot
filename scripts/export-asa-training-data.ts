import fs from "fs"
import path from "path"
import prisma from "../lib/prisma"

const ASA_SYSTEM_PROMPT = `You are ASA, the dedicated EventSlot AI for event organizers.
Your SOLE purpose is to help the organizer create, configure, understand, and manage their events and registration forms on EventSlot through a natural, friendly, efficient conversation.`

async function exportAsaTrainingData() {
  console.log("==> Fetching ASA interaction logs from database...")

  const logs = await prisma.auditLog.findMany({
    where: { action: "ASA_INTERACTION" },
    orderBy: { createdAt: "asc" },
  })

  console.log(`==> Found ${logs.length} logged interactions.`)

  const outDir = path.join(process.cwd(), "data")
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  const outFile = path.join(outDir, "asa-finetune-dataset.jsonl")
  const stream = fs.createWriteStream(outFile, { flags: "w" })

  let count = 0
  for (const log of logs) {
    const meta = (log.metadata as any) || {}
    const userQuery = meta.userQuery || meta.userNote
    const reply = meta.reply || (meta.extractedDraft ? JSON.stringify(meta.extractedDraft) : null)

    if (userQuery && reply) {
      const line = JSON.stringify({
        messages: [
          { role: "system", content: ASA_SYSTEM_PROMPT },
          { role: "user", content: String(userQuery) },
          { role: "assistant", content: String(reply) },
        ],
      })
      stream.write(line + "\n")
      count++
    }
  }

  stream.end()
  console.log(`==> Successfully exported ${count} training examples to:`)
  console.log(`    ${outFile}`)
  console.log("==> You can now upload this JSONL file to Google Colab for fine-tuning!")
}

exportAsaTrainingData()
  .catch((e) => {
    console.error("[Export Error]", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
