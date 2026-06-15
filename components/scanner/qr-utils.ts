import jsQR from "jsqr"

export type ScanInput =
  | { kind: "ticketCode"; value: string }
  | { kind: "identity"; value: string }
  | { kind: "qrPayload"; value: string }

export function normalizeDecodedValue(raw: string): ScanInput {
  const value = raw.trim()
  if (!value) return { kind: "ticketCode", value: "" }

  if (value.includes(":")) {
    return { kind: "qrPayload", value }
  }

  return { kind: "ticketCode", value: value.toUpperCase() }
}

export async function decodeQrFromImageFile(file: File): Promise<string | null> {
  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await loadImage(objectUrl)
    const canvas = document.createElement("canvas")
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight

    const ctx = canvas.getContext("2d")
    if (!ctx) return null

    ctx.drawImage(image, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const result = jsQR(imageData.data, imageData.width, imageData.height)

    return result?.data ?? null
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function extractTicketReferenceFromFile(file: File): Promise<string | null> {
  if (file.type.startsWith("image/")) {
    return decodeQrFromImageFile(file)
  }

  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const nameMatch = file.name.match(/ticket-([a-z0-9-]+)\.pdf$/i)
    if (nameMatch?.[1]) {
      return nameMatch[1].toUpperCase()
    }

    try {
      const raw = new TextDecoder("latin1").decode(await file.arrayBuffer())
      const directCode = raw.match(/#([A-Z0-9-]{6,})/i)
      if (directCode?.[1]) return directCode[1].toUpperCase()

      const filenameCode = raw.match(/ticket-([A-Z0-9-]{6,})\\.pdf/i)
      if (filenameCode?.[1]) return filenameCode[1].toUpperCase()
    } catch {
      return null
    }
  }

  return null
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

export function downloadCsv(filename: string, rows: string[][]) {
  const escaped = rows.map((row) => row.map(escapeCell).join(",")).join("\n")
  const blob = new Blob([escaped], { type: "text/csv;charset=utf-8" })
  const href = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = href
  link.download = filename
  link.click()
  URL.revokeObjectURL(href)
}

function escapeCell(value: string): string {
  const raw = value ?? ""
  if (raw.includes(",") || raw.includes("\n") || raw.includes('"')) {
    return `"${raw.replace(/"/g, '""')}"`
  }
  return raw
}
