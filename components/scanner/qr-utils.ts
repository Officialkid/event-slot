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
