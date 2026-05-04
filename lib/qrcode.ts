import QRCode from "qrcode"

export async function generateEventQRCode(registrationUrl: string): Promise<string> {
  const dataUrl = await QRCode.toDataURL(registrationUrl, {
    width: 512,
    margin: 2,
    color: {
      dark: "#0A0A0A",
      light: "#F0EDE6",
    },
    errorCorrectionLevel: "H",
  })

  return dataUrl
}

export async function generateEventQRCodeBuffer(registrationUrl: string): Promise<Buffer> {
  const buffer = await QRCode.toBuffer(registrationUrl, {
    width: 1024,
    margin: 3,
    color: {
      dark: "#0A0A0A",
      light: "#FFFFFF",
    },
    errorCorrectionLevel: "H",
  })

  return buffer
}
