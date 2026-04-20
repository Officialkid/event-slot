import { RateLimiterMemory } from 'rate-limiter-flexible'

// 5 attempts per IP per 10 minutes for login
export const loginRateLimiter = new RateLimiterMemory({
  points: 5,
  duration: 600, // 10 minutes in seconds
})

// 10 attempts per IP per 10 minutes for attendance lookup
export const attendanceRateLimiter = new RateLimiterMemory({
  points: 10,
  duration: 600,
})

// Helper to get client IP from Next.js request
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1'
  return ip
}
