import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import { normalizeOrgHandle } from '@/lib/organizationPermissions'
import { FollowButton } from '@/components/following/FollowButton'
import {
  Building2,
  Calendar,
  Globe,
  Mail,
  MapPin,
  Phone,
  MessageCircle,
  ShieldCheck,
  Users,
  ArrowRight,
} from 'lucide-react'

interface OrgProfilePageProps {
  params: Promise<{ handle: string }>
}

export async function generateMetadata(props: OrgProfilePageProps): Promise<Metadata> {
  const params = await props.params
  const handle = normalizeOrgHandle(params.handle)

  const org = await prisma.organization.findUnique({
    where: { handle },
    select: { name: true, description: true, publicationStatus: true },
  })

  if (!org || org.publicationStatus !== 'PUBLISHED') {
    return { title: 'Organization Not Found — EventSlot' }
  }

  return {
    title: `${org.name} (@${handle}) — EventSlot`,
    description: org.description || `Explore events hosted by ${org.name} on EventSlot.`,
  }
}

export default async function OrganizationPublicProfilePage(props: OrgProfilePageProps) {
  const params = await props.params
  const handle = normalizeOrgHandle(params.handle)

  const org = await prisma.organization.findUnique({
    where: { handle },
    include: {
      _count: {
        select: {
          followers: true,
          events: { where: { archived: false, status: 'active', visibility: 'PUBLIC' } },
        },
      },
      events: {
        where: {
          archived: false,
          status: 'active',
          visibility: 'PUBLIC',
        },
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          eventDate: true,
          eventEndAt: true,
          location: true,
          capacity: true,
          confirmedCount: true,
          imageUrl: true,
          entryFeeLabel: true,
          isPaid: true,
          ticketPrice: true,
          currency: true,
        },
        orderBy: { eventDate: 'asc' },
      },
    },
  })

  if (!org || org.publicationStatus !== 'PUBLISHED') {
    notFound()
  }

  const isVerified = org.verificationStatus === 'VERIFIED'
  const initials = org.name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const upcomingEvents = org.events.filter(
    (e) => !e.eventDate || new Date(e.eventDate).getTime() >= Date.now() - 24 * 60 * 60 * 1000
  )
  const pastEvents = org.events.filter(
    (e) => e.eventDate && new Date(e.eventDate).getTime() < Date.now() - 24 * 60 * 60 * 1000
  )

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] pb-20">
      {/* Cover / Header Banner */}
      <div
        className="w-full h-44 sm:h-56 relative overflow-hidden"
        style={{
          background: org.coverImage
            ? `url(${org.coverImage}) center/cover no-repeat`
            : 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 30%, #0f172a), #0f172a)',
        }}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      </div>

      {/* Main Container */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-16 sm:-mt-20 relative z-10">
        <div
          className="rounded-2xl p-6 sm:p-8 border shadow-sm transition-all"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
          }}
        >
          {/* Top Profile Bar */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-6 border-b border-[var(--border)]">
            <div className="flex items-center gap-4">
              {org.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={org.logo}
                  alt={org.name}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 shadow-md"
                  style={{ borderColor: 'var(--surface-2)' }}
                />
              ) : (
                <div
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center font-bold text-2xl sm:text-3xl border-2 shadow-md"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--accent) 20%, var(--surface))',
                    color: 'var(--accent)',
                    borderColor: 'var(--accent)',
                  }}
                >
                  {initials || <Building2 className="w-10 h-10" />}
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                    {org.name}
                  </h1>
                  {isVerified && (
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                      style={{
                        backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)',
                        color: 'var(--accent)',
                      }}
                      title="Verified Organization"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Verified
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5">
                  @{org.handle} {org.category ? `• ${org.category}` : ''}
                </p>
                <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)] mt-2">
                  <span className="flex items-center gap-1 font-medium">
                    <Users className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <strong>{org._count.followers}</strong> Followers
                  </span>
                  <span className="flex items-center gap-1 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <strong>{org._count.events}</strong> Events
                  </span>
                </div>
              </div>
            </div>

            {/* Follow Button */}
            <div className="sm:self-center">
              <FollowButton
                organiserUsername={org.handle}
                organiserName={org.name}
                targetType="organization"
                initialFollowerCount={org._count.followers}
                size="md"
              />
            </div>
          </div>

          {/* Description & Contact channels */}
          <div className="pt-5 pb-2">
            {org.description && (
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-3xl whitespace-pre-line mb-4">
                {org.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-muted)]">
              {org.website && (
                <a
                  href={org.website.startsWith('http') ? org.website : `https://${org.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-[var(--accent)] transition-colors"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>{org.website.replace(/^https?:\/\//, '')}</span>
                </a>
              )}
              {org.contactEmail && (
                <a
                  href={`mailto:${org.contactEmail}`}
                  className="flex items-center gap-1.5 hover:text-[var(--accent)] transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>{org.contactEmail}</span>
                </a>
              )}
              {org.contactPhone && (
                <a
                  href={`tel:${org.contactPhone}`}
                  className="flex items-center gap-1.5 hover:text-[var(--accent)] transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{org.contactPhone}</span>
                </a>
              )}
              {org.contactWhatsapp && (
                <a
                  href={`https://wa.me/${org.contactWhatsapp.replace(/[^\d]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-emerald-400 hover:underline"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp Office</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Events Grid Section */}
        <div className="mt-10">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight mb-4 flex items-center justify-between">
            <span>Upcoming Events</span>
            <span className="text-xs font-normal text-[var(--text-muted)]">
              {upcomingEvents.length} {upcomingEvents.length === 1 ? 'event' : 'events'}
            </span>
          </h2>

          {upcomingEvents.length === 0 ? (
            <div
              className="rounded-xl p-8 border text-center"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <Calendar className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium text-[var(--text-primary)]">
                No upcoming events scheduled right now.
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Follow @{org.handle} to get notified as soon as new events are announced!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcomingEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/${event.slug}`}
                  className="rounded-xl border p-5 transition-all hover:scale-[1.01] hover:border-[var(--accent)] flex flex-col justify-between group"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-bold text-base text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors line-clamp-1">
                        {event.title}
                      </h3>
                      {event.isPaid ? (
                        <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          {event.entryFeeLabel || `${event.currency} ${event.ticketPrice}`}
                        </span>
                      ) : (
                        <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-[var(--text-secondary)]">
                          Free
                        </span>
                      )}
                    </div>

                    {event.description && (
                      <p className="text-xs text-[var(--text-muted)] line-clamp-2 mb-3">
                        {event.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[var(--accent)]" />
                      {event.eventDate
                        ? new Date(event.eventDate).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'Date TBA'}
                    </span>
                    {event.location && (
                      <span className="flex items-center gap-1 truncate max-w-[150px]">
                        <MapPin className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </span>
                    )}
                    <span className="flex items-center gap-1 font-semibold text-[var(--accent)] group-hover:translate-x-0.5 transition-transform">
                      Details <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Past Events Section (if any) */}
        {pastEvents.length > 0 && (
          <div className="mt-12">
            <h2 className="text-base sm:text-lg font-bold tracking-tight mb-4 text-[var(--text-muted)]">
              Past Events ({pastEvents.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 opacity-80">
              {pastEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/${event.slug}`}
                  className="rounded-lg border p-4 transition hover:opacity-100 hover:border-[var(--border)]"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <h4 className="font-semibold text-sm truncate text-[var(--text-primary)]">
                    {event.title}
                  </h4>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    {event.eventDate
                      ? new Date(event.eventDate).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'Past Event'}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
