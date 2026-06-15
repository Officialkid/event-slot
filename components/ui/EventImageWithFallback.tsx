"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties } from "react"
import Image from "next/image"

type ImageStatus = "loaded" | "error"

type EventImageWithFallbackProps = {
  src?: string | null
  alt: string
  fill?: boolean
  width?: number
  height?: number
  sizes?: string
  priority?: boolean
  unoptimized?: boolean
  objectFit?: "cover" | "contain"
  objectPosition?: string
  borderRadius?: number | string
  containerStyle?: CSSProperties
  imageStyle?: CSSProperties
  fallbackText?: string
  onStatusChange?: (status: ImageStatus) => void
}

export default function EventImageWithFallback({
  src,
  alt,
  fill = false,
  width,
  height,
  sizes,
  priority = false,
  unoptimized = true,
  objectFit = "cover",
  objectPosition = "center",
  borderRadius = 0,
  containerStyle,
  imageStyle,
  fallbackText = "Event poster unavailable",
  onStatusChange,
}: EventImageWithFallbackProps) {
  const [hasError, setHasError] = useState(false)
  const errorHandledRef = useRef(false)

  const normalizedSrc = useMemo(() => {
    const raw = (src ?? "").trim()
    if (!raw) return null

    let candidate = raw
    // Recover from accidentally encoded full URLs such as https%3A%2F%2F...
    if (!/^https?:\/\//i.test(candidate) && /%2f|%3a/i.test(candidate)) {
      try {
        candidate = decodeURIComponent(candidate)
      } catch {
        candidate = raw
      }
    }

    try {
      const url = new URL(candidate)
      url.pathname = url.pathname.replace(/\/{2,}/g, "/")
      return url.toString()
    } catch {
      return null
    }
  }, [src])

  useEffect(() => {
    setHasError(false)
    errorHandledRef.current = false
  }, [normalizedSrc])

  const handleImageError = useCallback(() => {
    if (errorHandledRef.current) return
    errorHandledRef.current = true
    setHasError(true)
    onStatusChange?.("error")
  }, [onStatusChange])

  const shouldShowImage = Boolean(normalizedSrc) && !hasError

  if (!shouldShowImage) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          minHeight: fill ? 240 : undefined,
          background:
            "linear-gradient(135deg, rgba(20,20,20,1) 0%, rgba(34,34,34,1) 55%, rgba(10,10,10,1) 100%)",
          borderRadius,
          border: "0.5px solid rgba(240,237,230,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(240,237,230,0.42)",
          fontSize: "0.78rem",
          textAlign: "center",
          padding: "1rem",
          fontFamily: "var(--font-dm-sans)",
          ...containerStyle,
        }}
      >
        {fallbackText}
      </div>
    )
  }

  return (
    <div
      style={{
        position: fill ? "absolute" : "relative",
        inset: fill ? 0 : undefined,
        width: "100%",
        height: fill ? "100%" : undefined,
        borderRadius,
        overflow: "hidden",
        ...containerStyle,
      }}
    >
      <Image
        src={normalizedSrc as string}
        alt={alt}
        {...(fill ? { fill: true } : { width: width ?? 1200, height: height ?? 630 })}
        sizes={sizes}
        priority={priority}
        quality={100}
        unoptimized={unoptimized}
        style={{ objectFit, objectPosition, borderRadius, ...imageStyle }}
        onLoad={() => onStatusChange?.("loaded")}
        onError={handleImageError}
      />
    </div>
  )
}
