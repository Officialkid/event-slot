# EventSlot — System Documentation
*Auto-updated with every build. Last updated: April 9, 2026*

## What EventSlot Is
A smart event registration platform. Organizers create events with a
shareable link. Attendees register. When capacity is reached, overflow
goes to an automatic waitlist. When capacity increases, waitlisted
attendees are promoted and notified automatically.

## Tech Stack
- Framework: Next.js 14 (App Router)
- Language: TypeScript
- Styling: Tailwind CSS
- Database: Neon (PostgreSQL)
- ORM: Prisma
- Auth: NextAuth.js (Google OAuth + email/password)
- Email: Resend
- Payments: Paystack
- Rate limiting: Upstash Redis
- Hosting: Vercel

## User Roles
- **Attendee**: no account required, registers for events
- **Organizer**: account required, creates and manages events
- **Team Member**: invited by organizer, co-manages events
- **Super Admin**: danielmwaliliofficial@gmail.com only, full platform access

## Plans
| Plan | Price | Active Events | Free Registrations | Team Members | Data Retention |
|------|-------|---------------|-------------------|--------------|----------------|
| Free | Free | 1 | 100/event | 1 | 30 days |
| Pro | $19/mo (or $15/mo annual) | Unlimited | 500/event | 10 | Unlimited |
| Business | $49/mo (or $39/mo annual) | Unlimited | Unlimited | 20 | Unlimited |

## Credits
- $1 = 1 credit
- Used for pay-as-you-go features on Free and Pro plans
- Business plan has no pay-as-you-go costs

## Environment Variables
| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `NEXTAUTH_SECRET` | NextAuth session secret |
| `NEXTAUTH_URL` | App base URL |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `RESEND_API_KEY` | Resend email provider |
| `RESEND_FROM` | Sender email address |
| `PAYSTACK_SECRET_KEY` | Paystack API secret |
| `PAYSTACK_PRO_MONTHLY_PLAN_CODE` | Paystack plan code for Pro monthly |
| `PAYSTACK_PRO_ANNUAL_PLAN_CODE` | Paystack plan code for Pro annual |
| `PAYSTACK_BUSINESS_MONTHLY_PLAN_CODE` | Paystack plan code for Business monthly |
| `PAYSTACK_BUSINESS_ANNUAL_PLAN_CODE` | Paystack plan code for Business annual |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis rate limiting |
| `CRON_SECRET` | Bearer token for cron job authentication |
| `ADMIN_EMAILS` | Comma-separated admin email addresses |
