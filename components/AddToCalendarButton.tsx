'use client';
import { useState } from 'react';
import { Calendar, CheckCircle } from 'lucide-react';

interface Props {
  eventSlug:        string;
  _eventTitle:      string; // Reserved for future use
  isConnected:      boolean;
  staticGoogleUrl:  string;
  staticIcsUrl:     string;
}

export function AddToCalendarButton({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  eventSlug, _eventTitle, isConnected, staticGoogleUrl, staticIcsUrl,
}: Props) {
  const [state, setState] = useState<'idle' | 'adding' | 'done' | 'fallback'>('idle');

  const handleAdd = async () => {
    setState('adding');

    if (isConnected) {
      try {
        const res  = await fetch(`/api/events/${eventSlug}/calendar-add`, { method: 'POST' });
        const data = await res.json() as { autoPushed: boolean };
        if (data.autoPushed) {
          setState('done');
          return;
        }
      } catch {
        // Fall through to manual link
      }
    }

    window.open(staticGoogleUrl, '_blank');
    setState('fallback');
  };

  if (state === 'done') {
    return (
      <div className="flex items-center gap-2 border border-[#22C55E]/30
                      bg-[#22C55E]/10 rounded-xl px-4 py-3">
        <CheckCircle className="w-4 h-4 text-[#22C55E] shrink-0" />
        <div>
          <p className="text-[#22C55E] text-sm font-semibold">Added to Google Calendar</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            You&apos;ll get reminders 1 day and 1 hour before the event.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleAdd}
        disabled={state === 'adding'}
        className="w-full flex items-center justify-center gap-2 bg-[#4285F4]
                   text-white font-bold py-3 rounded-xl hover:bg-[#3367d6]
                   transition-colors disabled:opacity-50"
      >
        <Calendar className="w-4 h-4" />
        {state === 'adding'
          ? 'Adding to calendar...'
          : isConnected
          ? `Add to Google Calendar (auto)`
          : 'Add to Google Calendar'}
      </button>

      {/* Secondary options */}
      <div className="flex gap-2">
        <a
          href={staticIcsUrl}
          download
          className="flex-1 text-center border rounded-xl py-2
                     text-xs hover:text-[var(--text-primary)] hover:border-[#C8F55A]/40
                     transition-colors"
          style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          Download .ics (Apple / Outlook)
        </a>
      </div>

      {!isConnected && (
        <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
          <a href="/dashboard/profile#calendar" className="text-[#C8F55A] hover:underline">
            Connect Google Calendar
          </a>
          {' '}to add events automatically after registering.
        </p>
      )}
    </div>
  );
}
