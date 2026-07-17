import { getAdminDeployStatus, getAdminUpdates } from "@/lib/adminUpdates"

export default async function AdminUpdatesPage() {
  const [updates, deployStatus] = await Promise.all([getAdminUpdates(), getAdminDeployStatus()])

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-[var(--text-primary)] text-2xl font-bold mb-2">System Updates</h1>
      <p className="text-[var(--text-secondary)] text-sm mb-8">
        Live timeline pulled from the internal changelog and deploy history.
      </p>

      <section className="rounded-xl border border-[rgba(138,180,255,0.18)] bg-[rgba(138,180,255,0.06)] p-5 mb-8">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h2 className="text-[var(--text-primary)] text-lg font-semibold">Deploy Status Check</h2>
          <span className="inline-flex items-center rounded-full bg-[rgba(138,180,255,0.12)] px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[#8AB4FF]">
            Internal Signal
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-3 mb-4">
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
            <p className="text-[0.7rem] uppercase tracking-[0.16em] text-[var(--text-muted)] mb-2">System Doc Revision</p>
            <p className="text-[var(--text-primary)] text-sm font-mono">{deployStatus.documentedRevision ?? "Missing"}</p>
            <p className="text-[var(--text-secondary)] text-xs mt-2">{deployStatus.documentedAt ?? "No timestamp found"}</p>
          </div>
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
            <p className="text-[0.7rem] uppercase tracking-[0.16em] text-[var(--text-muted)] mb-2">Documented Commit</p>
            <p className="text-[var(--text-primary)] text-sm font-mono">{deployStatus.documentedCommit ?? "Missing"}</p>
          </div>
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
            <p className="text-[0.7rem] uppercase tracking-[0.16em] text-[var(--text-muted)] mb-2">Latest Deploy Log Entry</p>
            <p className="text-[var(--text-primary)] text-sm font-mono">{deployStatus.latestDeployEntry?.version ?? "Missing"}</p>
            <p className="text-[var(--text-secondary)] text-xs mt-2">{deployStatus.latestDeployEntry?.dateLabel ?? "No deploy entry found"}</p>
          </div>
        </div>

        <div className="space-y-2">
          {deployStatus.notes.map((note) => (
            <p key={note} className="text-sm text-[var(--text-secondary)]">
              {note}
            </p>
          ))}
        </div>
      </section>

      <div className="space-y-6">
        {updates.length === 0 ? (
          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <p className="text-[var(--text-muted)] text-sm">No changelog entries were found.</p>
          </section>
        ) : (
          updates.map((item) => (
            <section key={`${item.source}-${item.slug}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <h2 className="text-[#C8F55A] text-lg font-semibold">{item.dateLabel}</h2>
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em]"
                  style={{
                    background: item.source === "deploy" ? "rgba(138,180,255,0.12)" : "rgba(200,245,90,0.12)",
                    color: item.source === "deploy" ? "#8AB4FF" : "#C8F55A",
                  }}
                >
                  {item.source === "deploy" ? "Deploy" : "Changelog"}
                </span>
                {item.version ? (
                  <span className="text-[0.75rem] text-[var(--text-secondary)] font-mono">{item.version}</span>
                ) : null}
              </div>

              <h3 className="text-[var(--text-primary)] text-sm font-semibold mb-2">{item.title}</h3>

              {item.summary ? (
                <p className="text-[var(--text-secondary)] text-sm mb-3">{item.summary}</p>
              ) : null}

              {item.points.length > 0 ? (
                <ul className="list-disc pl-6 text-[var(--text-secondary)] text-sm space-y-1">
                  {item.points.map((point, index) => (
                    <li key={`${item.slug}-${index}`}>{point}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))
        )}
      </div>
    </div>
  )
}
