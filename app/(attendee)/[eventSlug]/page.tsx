import prisma from '@/lib/prisma'
import RegistrationForm from './RegistrationForm'

type EventQuestion = {
  id: string
  label: string
  type: string
  options?: string[]
  required: boolean
}

export default async function EventRegistrationPage({ params }: { params: { eventSlug: string } }) {
  const { eventSlug } = params
  const event = await prisma.event.findUnique({
    where: { slug: eventSlug },
    select: {
      id: true,
      title: true,
      description: true,
      capacity: true,
      confirmedCount: true,
      questions: true,
      deadline: true,
      organizerEmail: true,
      createdAt: true,
      eventDate: true,
      location: true,
      communityLink: true,
      imageUrl: true,
    },
  })

  if (!event) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] px-4 py-12">
        <div className="mx-auto max-w-[480px] rounded-[12px] border border-[rgba(240,237,230,0.08)] bg-[#141414] p-10 text-center">
          <h1 className="text-[1.4rem] font-semibold text-[#F0EDE6]" style={{ fontFamily: "var(--font-instrument-serif)" }}>
            Event not found
          </h1>
          <p className="mt-3 text-[0.9rem] font-[300] text-[rgba(240,237,230,0.45)]">
            This event does not exist.
          </p>
        </div>
      </div>
    )
  }

  if (event.deadline && new Date(event.deadline) < new Date()) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] px-4 py-12">
        <div className="mx-auto max-w-[480px] rounded-[12px] border border-[rgba(240,237,230,0.08)] bg-[#141414] p-10 text-center">
          <h1 className="text-[1.4rem] font-semibold text-[#F0EDE6]" style={{ fontFamily: "var(--font-instrument-serif)" }}>
            Registration closed
          </h1>
          <p className="mt-3 text-[0.9rem] font-[300] text-[rgba(240,237,230,0.45)]">
            Registration for this event is closed.
          </p>
          <span className="mt-4 inline-flex rounded-full border border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.1)] px-3 py-1 text-[0.7rem] text-[#FF6B6B]">
            Closed
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] px-4 py-12">
      <RegistrationForm event={{ ...event, slug: eventSlug, questions: event.questions as EventQuestion[] }} />
    </div>
  )
}
