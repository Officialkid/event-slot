import prisma from "@/lib/prisma"

type EventQuestion = { id: string; type: string; label: string }
type Answer = { questionId: string; value: string }

export default async function VerifyPage({ params }: { params: { confirmationCode: string } }) {
  const { confirmationCode } = params

  const registration = await prisma.registration.findUnique({
    where: { confirmationCode },
    include: {
      event: {
        select: {
          title: true,
          eventDate: true,
          location: true,
          questions: true,
        },
      },
    },
  })

  const valid = registration?.status === "confirmed"

  let attendeeName = ""
  if (registration) {
    const questions = (registration.event.questions as EventQuestion[]) ?? []
    const answers = (registration.answers as Answer[]) ?? []
    const nameQ = questions.find((q) => q.type === "text" && q.label.toLowerCase().includes("name"))
    if (nameQ) attendeeName = answers.find((a) => a.questionId === nameQ.id)?.value?.trim() ?? ""
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0A0A0A",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1.25rem",
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: "100%",
          background: "#141414",
          border: `1px solid ${valid ? "rgba(200,245,90,0.25)" : "rgba(255,107,107,0.25)"}`,
          borderRadius: 16,
          padding: "2.5rem 2rem",
          textAlign: "center",
        }}
      >
        {/* Icon */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: valid ? "rgba(200,245,90,0.12)" : "rgba(255,107,107,0.1)",
            border: `1px solid ${valid ? "rgba(200,245,90,0.3)" : "rgba(255,107,107,0.3)"}`,
            marginBottom: "1.25rem",
          }}
        >
          {valid ? (
            <svg width="24" height="18" viewBox="0 0 24 18" fill="none">
              <path d="M2 9L9 16L22 2" stroke="#C8F55A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <line x1="18" y1="6" x2="6" y2="18" stroke="#FF6B6B" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="6" y1="6" x2="18" y2="18" stroke="#FF6B6B" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          )}
        </div>

        {/* Status label */}
        <span
          style={{
            display: "inline-block",
            borderRadius: 999,
            padding: "3px 12px",
            fontSize: "0.7rem",
            fontFamily: "var(--font-dm-sans, system-ui)",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            background: valid ? "rgba(200,245,90,0.12)" : "rgba(255,107,107,0.1)",
            border: `1px solid ${valid ? "rgba(200,245,90,0.3)" : "rgba(255,107,107,0.3)"}`,
            color: valid ? "#C8F55A" : "#FF6B6B",
            marginBottom: "1rem",
          }}
        >
          {valid ? "Valid Ticket" : "Invalid"}
        </span>

        {valid && registration ? (
          <>
            <h2
              style={{
                fontFamily: "var(--font-instrument-serif, Georgia, serif)",
                fontSize: "1.5rem",
                fontWeight: 400,
                color: "#F0EDE6",
                margin: "0 0 0.5rem",
              }}
            >
              {attendeeName || "Attendee"}
            </h2>
            <p
              style={{
                fontFamily: "var(--font-dm-sans, system-ui)",
                fontSize: "0.9rem",
                color: "rgba(240,237,230,0.55)",
                margin: "0 0 1.25rem",
              }}
            >
              {registration.event.title}
            </p>
            {registration.event.eventDate && (
              <p style={{ fontSize: "0.78rem", color: "rgba(240,237,230,0.4)", margin: "0 0 0.25rem", fontFamily: "var(--font-dm-sans, system-ui)" }}>
                📅{" "}
                {new Date(registration.event.eventDate).toLocaleString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })}
              </p>
            )}
            {registration.event.location && (
              <p style={{ fontSize: "0.78rem", color: "rgba(240,237,230,0.4)", margin: "0 0 1rem", fontFamily: "var(--font-dm-sans, system-ui)" }}>
                📍 {registration.event.location}
              </p>
            )}
            <p style={{ fontFamily: "monospace", fontSize: "0.8rem", letterSpacing: "0.15em", color: "rgba(200,245,90,0.6)", margin: 0 }}>
              {confirmationCode}
            </p>
          </>
        ) : (
          <>
            <h2
              style={{
                fontFamily: "var(--font-instrument-serif, Georgia, serif)",
                fontSize: "1.5rem",
                fontWeight: 400,
                color: "#F0EDE6",
                margin: "0 0 0.5rem",
              }}
            >
              Ticket not found
            </h2>
            <p style={{ fontFamily: "var(--font-dm-sans, system-ui)", fontSize: "0.9rem", color: "rgba(240,237,230,0.45)", margin: 0 }}>
              This confirmation code is not valid or does not match any confirmed registration.
            </p>
          </>
        )}
      </div>
    </main>
  )
}
