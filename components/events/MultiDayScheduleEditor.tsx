'use client'

import React from 'react'
import { Calendar, Plus, Trash2, MapPin, Clock, Info } from 'lucide-react'

export interface MultiDayScheduleItem {
  id?: string
  dayNumber: number
  label?: string
  date: string
  startTime?: string
  endTime?: string
  venue?: string
  mapDirectionsUrl?: string
}

interface MultiDayScheduleEditorProps {
  enabled: boolean
  onToggle: (enabled: boolean) => void
  schedule: MultiDayScheduleItem[]
  onChange: (schedule: MultiDayScheduleItem[]) => void
  fallbackStartDate?: string
  fallbackEndDate?: string
  fallbackVenue?: string
  fallbackMapUrl?: string
}

export function MultiDayScheduleEditor({
  enabled,
  onToggle,
  schedule,
  onChange,
  fallbackStartDate,
  fallbackEndDate,
  fallbackVenue,
  fallbackMapUrl,
}: MultiDayScheduleEditorProps) {
  const handleToggle = (checked: boolean) => {
    onToggle(checked)
    if (checked && (!schedule || schedule.length === 0)) {
      // Auto-populate Day 1 & Day 2 from existing event data
      const sDate = fallbackStartDate ? fallbackStartDate.slice(0, 10) : new Date().toISOString().slice(0, 10)
      const sTime = fallbackStartDate && fallbackStartDate.includes('T') ? fallbackStartDate.slice(11, 16) : '09:00'
      const eTime = fallbackEndDate && fallbackEndDate.includes('T') ? fallbackEndDate.slice(11, 16) : '17:00'

      const nextDay = new Date(sDate)
      nextDay.setDate(nextDay.getDate() + 1)
      const nextDateStr = nextDay.toISOString().slice(0, 10)

      onChange([
        {
          dayNumber: 1,
          label: 'Day 1',
          date: sDate,
          startTime: sTime,
          endTime: eTime,
          venue: fallbackVenue || '',
          mapDirectionsUrl: fallbackMapUrl || '',
        },
        {
          dayNumber: 2,
          label: 'Day 2',
          date: nextDateStr,
          startTime: sTime,
          endTime: eTime,
          venue: fallbackVenue || '',
          mapDirectionsUrl: fallbackMapUrl || '',
        },
      ])
    }
  }

  const addDay = () => {
    const nextNumber = schedule.length + 1
    let nextDateStr = new Date().toISOString().slice(0, 10)

    if (schedule.length > 0) {
      const last = schedule[schedule.length - 1]
      if (last.date) {
        const d = new Date(last.date)
        d.setDate(d.getDate() + 1)
        nextDateStr = d.toISOString().slice(0, 10)
      }
    }

    const newItem: MultiDayScheduleItem = {
      dayNumber: nextNumber,
      label: `Day ${nextNumber}`,
      date: nextDateStr,
      startTime: schedule[0]?.startTime || '09:00',
      endTime: schedule[0]?.endTime || '17:00',
      venue: schedule[schedule.length - 1]?.venue || fallbackVenue || '',
      mapDirectionsUrl: schedule[schedule.length - 1]?.mapDirectionsUrl || fallbackMapUrl || '',
    }

    onChange([...schedule, newItem])
  }

  const updateDay = (index: number, patch: Partial<MultiDayScheduleItem>) => {
    const updated = schedule.map((item, i) => (i === index ? { ...item, ...patch } : item))
    onChange(updated)
  }

  const removeDay = (index: number) => {
    if (schedule.length <= 1) return
    const filtered = schedule.filter((_, i) => i !== index)
    const renumbered = filtered.map((item, idx) => ({
      ...item,
      dayNumber: idx + 1,
      label: item.label?.startsWith('Day ') ? `Day ${idx + 1}` : item.label,
    }))
    onChange(renumbered)
  }

  return (
    <div
      style={{
        background: 'var(--surface, #141414)',
        border: '1px solid var(--border, rgba(255,255,255,0.08))',
        borderRadius: 16,
        padding: '1.5rem',
        marginTop: '1.25rem',
      }}
    >
      {/* Header & Toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'color-mix(in srgb, var(--accent, #C8F55A) 12%, transparent)',
              color: 'var(--accent, #C8F55A)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Calendar size={18} />
          </div>
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: '0.95rem',
                fontWeight: 600,
                color: 'var(--text-primary, #FFFFFF)',
                fontFamily: 'var(--font-dm-sans, inherit)',
              }}
            >
              Multi-Day Schedule & Venues
            </h3>
            <p
              style={{
                margin: '0.2rem 0 0',
                fontSize: '0.78rem',
                color: 'var(--text-secondary, #A3A3A3)',
                fontFamily: 'var(--font-dm-sans, inherit)',
              }}
            >
              Configure separate dates, times, or venues for multi-day conventions & workshops
            </p>
          </div>
        </div>

        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.6rem',
            cursor: 'pointer',
            fontSize: '0.82rem',
            fontWeight: 500,
            color: 'var(--text-primary, #FFFFFF)',
          }}
        >
          <span>Enable Multi-Day</span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => handleToggle(e.target.checked)}
            style={{
              width: 18,
              height: 18,
              accentColor: 'var(--accent, #C8F55A)',
              cursor: 'pointer',
            }}
          />
        </label>
      </div>

      {/* Editor Body */}
      {enabled && (
        <div style={{ marginTop: '1.25rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              borderRadius: 10,
              background: 'color-mix(in srgb, var(--accent, #C8F55A) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent, #C8F55A) 20%, transparent)',
              marginBottom: '1rem',
              fontSize: '0.78rem',
              color: 'var(--text-secondary, #A3A3A3)',
            }}
          >
            <Info size={16} color="var(--accent, #C8F55A)" style={{ flexShrink: 0 }} />
            <span>
              Each attendee ticket automatically permits <strong>1 admission per scheduled day</strong> ({schedule.length} total admissions).
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {schedule.map((item, index) => (
              <div
                key={index}
                style={{
                  background: 'color-mix(in srgb, var(--surface, #141414) 95%, var(--text-primary, #FFFFFF) 5%)',
                  border: '1px solid var(--border, rgba(255,255,255,0.06))',
                  borderRadius: 12,
                  padding: '1.1rem',
                }}
              >
                {/* Day Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.85rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        background: 'color-mix(in srgb, var(--accent, #C8F55A) 15%, transparent)',
                        color: 'var(--accent, #C8F55A)',
                        padding: '0.2rem 0.6rem',
                        borderRadius: 999,
                      }}
                    >
                      Day {item.dayNumber}
                    </span>
                    <input
                      type="text"
                      value={item.label || ''}
                      placeholder={`e.g. Day ${item.dayNumber} - Keynotes`}
                      onChange={(e) => updateDay(index, { label: e.target.value })}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '1px solid var(--border, rgba(255,255,255,0.12))',
                        color: 'var(--text-primary, #FFFFFF)',
                        fontSize: '0.82rem',
                        padding: '0.2rem 0.4rem',
                        outline: 'none',
                        fontFamily: 'var(--font-dm-sans, inherit)',
                        width: 200,
                      }}
                    />
                  </div>

                  {schedule.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDay(index)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--error, #EF4444)',
                        cursor: 'pointer',
                        padding: '0.3rem',
                        display: 'flex',
                        alignItems: 'center',
                        borderRadius: 6,
                        opacity: 0.8,
                        transition: 'opacity 0.15s',
                      }}
                      title="Remove this day"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                {/* Day Inputs Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '0.75rem',
                  }}
                >
                  {/* Date */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.72rem',
                        color: 'var(--text-muted, #737373)',
                        marginBottom: '0.3rem',
                        fontWeight: 500,
                      }}
                    >
                      Date
                    </label>
                    <input
                      type="date"
                      value={item.date}
                      onChange={(e) => updateDay(index, { date: e.target.value })}
                      style={{
                        width: '100%',
                        background: 'var(--bg-page, #0A0A0A)',
                        border: '1px solid var(--border, rgba(255,255,255,0.1))',
                        borderRadius: 8,
                        color: 'var(--text-primary, #FFFFFF)',
                        fontSize: '0.8rem',
                        padding: '0.55rem 0.75rem',
                        outline: 'none',
                      }}
                    />
                  </div>

                  {/* Start Time */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.72rem',
                        color: 'var(--text-muted, #737373)',
                        marginBottom: '0.3rem',
                        fontWeight: 500,
                      }}
                    >
                      Start Time
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="time"
                        value={item.startTime || ''}
                        onChange={(e) => updateDay(index, { startTime: e.target.value })}
                        style={{
                          width: '100%',
                          background: 'var(--bg-page, #0A0A0A)',
                          border: '1px solid var(--border, rgba(255,255,255,0.1))',
                          borderRadius: 8,
                          color: 'var(--text-primary, #FFFFFF)',
                          fontSize: '0.8rem',
                          padding: '0.55rem 0.75rem',
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>

                  {/* End Time */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.72rem',
                        color: 'var(--text-muted, #737373)',
                        marginBottom: '0.3rem',
                        fontWeight: 500,
                      }}
                    >
                      End Time
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="time"
                        value={item.endTime || ''}
                        onChange={(e) => updateDay(index, { endTime: e.target.value })}
                        style={{
                          width: '100%',
                          background: 'var(--bg-page, #0A0A0A)',
                          border: '1px solid var(--border, rgba(255,255,255,0.1))',
                          borderRadius: 8,
                          color: 'var(--text-primary, #FFFFFF)',
                          fontSize: '0.8rem',
                          padding: '0.55rem 0.75rem',
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Venue and Directions */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: '0.75rem',
                    marginTop: '0.75rem',
                  }}
                >
                  {/* Venue Name */}
                  <div>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.72rem',
                        color: 'var(--text-muted, #737373)',
                        marginBottom: '0.3rem',
                        fontWeight: 500,
                      }}
                    >
                      <MapPin size={12} color="var(--accent, #C8F55A)" />
                      <span>Venue Address or Location</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Sarit Expo Center"
                      value={item.venue || ''}
                      onChange={(e) => updateDay(index, { venue: e.target.value })}
                      style={{
                        width: '100%',
                        background: 'var(--bg-page, #0A0A0A)',
                        border: '1px solid var(--border, rgba(255,255,255,0.1))',
                        borderRadius: 8,
                        color: 'var(--text-primary, #FFFFFF)',
                        fontSize: '0.8rem',
                        padding: '0.55rem 0.75rem',
                        outline: 'none',
                      }}
                    />
                  </div>

                  {/* Google Maps link */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.72rem',
                        color: 'var(--text-muted, #737373)',
                        marginBottom: '0.3rem',
                        fontWeight: 500,
                      }}
                    >
                      Google Maps Link (optional)
                    </label>
                    <input
                      type="url"
                      placeholder="https://maps.google.com/..."
                      value={item.mapDirectionsUrl || ''}
                      onChange={(e) => updateDay(index, { mapDirectionsUrl: e.target.value })}
                      style={{
                        width: '100%',
                        background: 'var(--bg-page, #0A0A0A)',
                        border: '1px solid var(--border, rgba(255,255,255,0.1))',
                        borderRadius: 8,
                        color: 'var(--text-primary, #FFFFFF)',
                        fontSize: '0.8rem',
                        padding: '0.55rem 0.75rem',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add Day Button */}
          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-start' }}>
            <button
              type="button"
              onClick={addDay}
              style={{
                background: 'color-mix(in srgb, var(--accent, #C8F55A) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent, #C8F55A) 30%, transparent)',
                color: 'var(--accent, #C8F55A)',
                borderRadius: 8,
                padding: '0.5rem 1rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                transition: 'all 0.15s ease',
              }}
            >
              <Plus size={15} />
              <span>Add Another Day</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
