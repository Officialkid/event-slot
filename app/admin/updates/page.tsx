import { getAdminUpdates } from "@/lib/adminUpdates"

export default async function AdminUpdatesPage() {
  const updates = await getAdminUpdates()

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-[#F0EDE6] text-2xl font-bold mb-2">System Updates</h1>
      <p className="text-[#8A8A8A] text-sm mb-8">
        Live timeline pulled from the internal changelog and deploy history.
      </p>

      <div className="space-y-6">
        {updates.length === 0 ? (
          <section className="rounded-xl border border-[rgba(240,237,230,0.1)] bg-[#141414] p-5">
            <p className="text-[#7A7A7A] text-sm">No changelog entries were found.</p>
          </section>
        ) : (
          updates.map((item) => (
            <section key={`${item.source}-${item.slug}`} className="rounded-xl border border-[rgba(240,237,230,0.1)] bg-[#141414] p-5">
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
                  <span className="text-[0.75rem] text-[rgba(240,237,230,0.45)] font-mono">{item.version}</span>
                ) : null}
              </div>

              <h3 className="text-[#F0EDE6] text-sm font-semibold mb-2">{item.title}</h3>

              {item.summary ? (
                <p className="text-[#A3A3A3] text-sm mb-3">{item.summary}</p>
              ) : null}

              {item.points.length > 0 ? (
                <ul className="list-disc pl-6 text-[#B9B9B9] text-sm space-y-1">
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
