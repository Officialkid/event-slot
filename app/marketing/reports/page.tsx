"use client"

import { useState, useEffect } from "react"
import {
  FileSpreadsheet,
  Plus,
  Calendar,
  Download,
  Eye,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  TrendingUp,
} from "lucide-react"

interface MarketingReport {
  id: string
  title: string
  reportType: "WEEKLY" | "MONTHLY" | "CAMPAIGN" | "CHANNEL"
  periodStart: string
  periodEnd: string
  campaignId: string | null
  channel: string | null
  dataSnapshot: {
    trackedVisits: number
    signupsAttributed: number
    eventsCreatedAttributed: number
    activeCampaigns: number
    contentPublished: number
    totalSignups: number
    totalEventsCreated: number
  }
  aiSummary: string | null
  keyObservations: string[] | null
  recommendedExperiments: string[] | null
  createdAt: string
}

export default function MarketingReportsPage() {
  const [reports, setReports] = useState<MarketingReport[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedReport, setSelectedReport] = useState<MarketingReport | null>(null)
  const [showModal, setShowModal] = useState(false)

  // Report Generator Form State
  const [reportType, setReportType] = useState<"WEEKLY" | "MONTHLY" | "CAMPAIGN" | "CHANNEL">("WEEKLY")
  const [title, setTitle] = useState("")
  const [periodStart, setPeriodStart] = useState(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  )
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().split("T")[0])
  const [submitting, setSubmitting] = useState(false)

  const fetchReports = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/marketing/reports", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load reports")
      const data = await res.json()
      setReports(data.reports || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [])

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      const res = await fetch("/api/marketing/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || undefined,
          reportType,
          periodStart,
          periodEnd,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to generate report")

      setShowModal(false)
      setTitle("")
      fetchReports()
      setSelectedReport(data.report)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error generating report")
    } finally {
      setSubmitting(false)
    }
  }

  const exportReportCsv = (report: MarketingReport) => {
    const rows = [
      ["EventSlot Marketing Report", report.title],
      ["Type", report.reportType],
      ["Period", `${new Date(report.periodStart).toLocaleDateString()} to ${new Date(report.periodEnd).toLocaleDateString()}`],
      ["Generated At", new Date(report.createdAt).toLocaleString()],
      [],
      ["Metric", "Value"],
      ["Tracked Visits", report.dataSnapshot.trackedVisits],
      ["Attributed Signups", report.dataSnapshot.signupsAttributed],
      ["Attributed Events Created", report.dataSnapshot.eventsCreatedAttributed],
      ["Active Campaigns", report.dataSnapshot.activeCampaigns],
      ["Content Published", report.dataSnapshot.contentPublished],
      ["Total New Signups in Period", report.dataSnapshot.totalSignups],
      ["Total Events Created in Period", report.dataSnapshot.totalEventsCreated],
      [],
      ["AI Executive Summary", `"${(report.aiSummary || "").replace(/"/g, '""')}"`],
    ]

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `${report.title.toLowerCase().replace(/\s+/g, "_")}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#262626] pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <FileSpreadsheet className="w-6 h-6 text-[#C8F55A]" />
            Marketing Reports & Exports
          </h1>
          <p className="text-sm text-[#A3A3A3] mt-1">
            Generate and export periodic executive marketing summaries, telemetry snapshots, and AI-grounded observations.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#C8F55A] hover:bg-[#b8e84a] text-[#0A0A0A] transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Generate Report
        </button>
      </div>

      {/* Reports Listing */}
      {loading ? (
        <div className="p-16 text-center text-xs text-[#737373]">Loading reports...</div>
      ) : reports.length === 0 ? (
        <div className="rounded-2xl bg-[#141414] border border-[#262626] p-16 text-center space-y-3">
          <p className="text-sm text-neutral-400">No reports generated yet.</p>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#1F1F1F] text-[#C8F55A]"
          >
            + Generate First Report
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {reports.map((report) => (
            <div
              key={report.id}
              className="rounded-2xl bg-[#141414] border border-[#262626] p-5 flex flex-col justify-between hover:border-[#3A3A3A] transition space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-[#1A1A1A] text-[#C8F55A] border border-[#2A2A2A]">
                    {report.reportType}
                  </span>
                  <span className="text-xs text-[#737373]">
                    {new Date(report.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white line-clamp-1">{report.title}</h3>
                  <p className="text-xs text-[#737373] mt-0.5">
                    {new Date(report.periodStart).toLocaleDateString()} — {new Date(report.periodEnd).toLocaleDateString()}
                  </p>
                </div>

                {report.aiSummary && (
                  <p className="text-xs text-[#A3A3A3] line-clamp-3 bg-[#0A0A0A] p-3 rounded-xl border border-[#262626]">
                    {report.aiSummary}
                  </p>
                )}

                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="p-2 rounded-lg bg-[#0A0A0A] border border-[#262626]">
                    <p className="text-[10px] text-[#737373] uppercase">Visits</p>
                    <p className="text-xs font-bold text-white mt-0.5">{report.dataSnapshot.trackedVisits}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-[#0A0A0A] border border-[#262626]">
                    <p className="text-[10px] text-[#737373] uppercase">Signups</p>
                    <p className="text-xs font-bold text-[#C8F55A] mt-0.5">{report.dataSnapshot.signupsAttributed}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-[#0A0A0A] border border-[#262626]">
                    <p className="text-[10px] text-[#737373] uppercase">Posts</p>
                    <p className="text-xs font-bold text-white mt-0.5">{report.dataSnapshot.contentPublished}</p>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#1F1F1F] flex items-center justify-between gap-2">
                <button
                  onClick={() => setSelectedReport(report)}
                  className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-3 rounded-lg text-xs font-semibold bg-[#1F1F1F] hover:bg-[#262626] text-white transition"
                >
                  <Eye className="w-3.5 h-3.5" /> View
                </button>

                <button
                  onClick={() => exportReportCsv(report)}
                  className="inline-flex items-center justify-center gap-1 py-1.5 px-3 rounded-lg text-xs font-semibold bg-[#1F1F1F] hover:bg-[#262626] text-[#C8F55A] transition"
                  title="Download CSV"
                >
                  <Download className="w-3.5 h-3.5" /> Export
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Detail Report Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <div className="bg-[#141414] border border-[#262626] rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#262626] pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">{selectedReport.title}</h3>
                <p className="text-xs text-[#737373]">
                  Period: {new Date(selectedReport.periodStart).toLocaleDateString()} — {new Date(selectedReport.periodEnd).toLocaleDateString()}
                </p>
              </div>
              <button onClick={() => setSelectedReport(null)} className="text-[#737373] hover:text-white">
                ✕
              </button>
            </div>

            {/* AI Executive Summary */}
            {selectedReport.aiSummary && (
              <div className="p-4 rounded-xl bg-gradient-to-br from-[#141414] to-[#1F1F1F] border border-[#2A2A2A] space-y-1.5">
                <p className="text-xs font-bold text-[#C8F55A] uppercase tracking-wide flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> AI Executive Synthesis
                </p>
                <p className="text-xs text-neutral-200 leading-relaxed">{selectedReport.aiSummary}</p>
              </div>
            )}

            {/* Observations & Recommendations */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {selectedReport.keyObservations && (
                <div className="p-4 rounded-xl bg-[#0A0A0A] border border-[#262626] space-y-2">
                  <p className="text-xs font-bold text-emerald-400 uppercase">Key Observations</p>
                  <ul className="space-y-1 text-xs text-[#A3A3A3]">
                    {selectedReport.keyObservations.map((obs, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-emerald-400 font-bold">•</span>
                        <span>{obs}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedReport.recommendedExperiments && (
                <div className="p-4 rounded-xl bg-[#0A0A0A] border border-[#262626] space-y-2">
                  <p className="text-xs font-bold text-[#C8F55A] uppercase">Recommended Experiments</p>
                  <ul className="space-y-1 text-xs text-[#A3A3A3]">
                    {selectedReport.recommendedExperiments.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-[#C8F55A] font-bold">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Frozen Snapshot Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-[#0A0A0A] border border-[#262626]">
                <p className="text-[10px] text-[#737373] uppercase">Tracked Visits</p>
                <p className="text-lg font-bold text-white mt-0.5">{selectedReport.dataSnapshot.trackedVisits}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#0A0A0A] border border-[#262626]">
                <p className="text-[10px] text-[#737373] uppercase">Attributed Signups</p>
                <p className="text-lg font-bold text-[#C8F55A] mt-0.5">{selectedReport.dataSnapshot.signupsAttributed}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#0A0A0A] border border-[#262626]">
                <p className="text-[10px] text-[#737373] uppercase">Events Created</p>
                <p className="text-lg font-bold text-white mt-0.5">{selectedReport.dataSnapshot.eventsCreatedAttributed}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#0A0A0A] border border-[#262626]">
                <p className="text-[10px] text-[#737373] uppercase">Posts Published</p>
                <p className="text-lg font-bold text-white mt-0.5">{selectedReport.dataSnapshot.contentPublished}</p>
              </div>
            </div>

            <div className="pt-3 flex justify-between items-center border-t border-[#262626]">
              <button
                onClick={() => exportReportCsv(selectedReport)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#1F1F1F] hover:bg-[#262626] text-[#C8F55A] border border-[#333] transition"
              >
                <Download className="w-3.5 h-3.5" /> Export to CSV
              </button>
              <button
                onClick={() => setSelectedReport(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white bg-[#1F1F1F]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generator Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <div className="bg-[#141414] border border-[#262626] rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#262626] pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#C8F55A]" />
                Generate Marketing Report
              </h3>
              <button onClick={() => setShowModal(false)} className="text-[#737373] hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleGenerateReport} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                  Report Cadence / Type *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["WEEKLY", "MONTHLY", "CAMPAIGN", "CHANNEL"] as const).map((t) => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => setReportType(t)}
                      className={`p-2 rounded-xl text-xs font-semibold border transition ${
                        reportType === t
                          ? "bg-[#C8F55A]/10 border-[#C8F55A] text-[#C8F55A]"
                          : "bg-[#0A0A0A] border-[#262626] text-[#737373] hover:text-white"
                      }`}
                    >
                      {t.charAt(0) + t.slice(1).toLowerCase()} Report
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                  Custom Report Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Q3 Launch Marketing Audit"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C8F55A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C8F55A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C8F55A]"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-[#262626]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#737373] hover:text-white bg-[#1F1F1F]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#C8F55A] text-[#0A0A0A] hover:bg-[#b8e84a] transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {submitting ? "Analyzing & Generating..." : "Generate Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
