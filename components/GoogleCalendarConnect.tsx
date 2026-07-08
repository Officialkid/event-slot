'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface Props {
  isConnected: boolean;
  variant?: 'profile' | 'compact';
}

export function GoogleCalendarConnect({ isConnected, variant = 'profile' }: Props) {
  const [disconnecting, setDisconnecting] = useState(false);
  const router = useRouter();

  const handleConnect = () => {
    window.location.href = '/api/auth/google-calendar';
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Google Calendar? Your existing calendar events will not be removed.')) return;
    setDisconnecting(true);
    await fetch('/api/auth/google-calendar/disconnect', { method: 'POST' });
    setDisconnecting(false);
    router.refresh();
  };

  if (variant === 'compact') {
    return isConnected ? (
      <div className="flex items-center gap-2">
        <CheckCircle className="w-4 h-4 text-[#22C55E]" />
        <span className="text-[#22C55E] text-xs font-medium">Google Calendar connected</span>
        <button
          onClick={handleDisconnect}
          className="text-[#525252] text-xs hover:text-[#EF4444] transition-colors ml-2"
        >
          Disconnect
        </button>
      </div>
    ) : (
      <button
        onClick={handleConnect}
        className="flex items-center gap-2 border border-[#2A2A2A] rounded-lg px-3 py-1.5 text-[#A3A3A3] text-xs hover:border-[#4285F4]/50 hover:text-white transition-colors"
      >
        <Calendar className="w-3.5 h-3.5" />
        Connect Google Calendar
      </button>
    );
  }

  return (
    <div className="border border-[#2A2A2A] rounded-2xl p-5 bg-[#141414] space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#4285F4]/10 border border-[#4285F4]/30 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
            <path d="M19.5 3h-15A1.5 1.5 0 0 0 3 4.5v15A1.5 1.5 0 0 0 4.5 21h15a1.5 1.5 0 0 0 1.5-1.5v-15A1.5 1.5 0 0 0 19.5 3Z" fill="#4285F4" />
            <path d="M8 10h8v2H8zm0 4h5v2H8z" fill="white" />
            <path d="M6 7h12v2H6z" fill="#EA4335" />
          </svg>
        </div>
        <div>
          <p className="text-white font-semibold text-sm">Google Calendar</p>
          <p className="text-[#525252] text-xs">
            {isConnected ? 'Your events sync automatically' : 'Sync EventSlot events to your calendar'}
          </p>
        </div>
        {isConnected ? (
          <span className="ml-auto text-xs bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/30 px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Connected
          </span>
        ) : (
          <span className="ml-auto text-xs bg-[#525252]/20 text-[#A3A3A3] border border-[#2A2A2A] px-2.5 py-1 rounded-full">
            Not connected
          </span>
        )}
      </div>

      {!isConnected && (
        <>
          <ul className="space-y-2">
            {[
              'Events appear in your Google Calendar automatically',
              'Google sends you reminders 1 day and 1 hour before',
              'Changes to event date/time sync instantly',
              'Cancelled events are marked in your calendar',
            ].map((benefit) => (
              <li key={benefit} className="flex items-start gap-2">
                <span className="text-[#C8F55A] text-xs mt-0.5 shrink-0">+</span>
                <span className="text-[#A3A3A3] text-xs">{benefit}</span>
              </li>
            ))}
          </ul>
          <div className="rounded-xl border border-[#4285F4]/20 bg-[#4285F4]/8 p-3">
            <p className="text-[#D7E7FF] text-xs font-medium">
              If Google says EventSlot is still in testing, only approved tester emails can connect until the OAuth consent screen is published.
            </p>
          </div>
        </>
      )}

      {isConnected && (
        <div className="bg-[#22C55E]/5 border border-[#22C55E]/20 rounded-xl p-3 space-y-1.5">
          <p className="text-[#22C55E] text-xs font-semibold">What syncs automatically:</p>
          <p className="text-[#A3A3A3] text-xs">- New events you create -&gt; added to Google Calendar immediately</p>
          <p className="text-[#A3A3A3] text-xs">- Event date/time changes -&gt; your calendar updates within seconds</p>
          <p className="text-[#A3A3A3] text-xs">- Cancelled events -&gt; marked as cancelled in your calendar</p>
          <p className="text-[#A3A3A3] text-xs">- Google sends reminders 1 day + 1 hour before each event</p>
        </div>
      )}

      {isConnected ? (
        <button
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="w-full flex items-center justify-center gap-2 border border-[#2A2A2A] rounded-xl py-2.5 text-[#525252] text-sm hover:border-[#EF4444]/40 hover:text-[#EF4444] transition-colors disabled:opacity-50"
        >
          {disconnecting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Disconnecting...
            </>
          ) : (
            <>
              <XCircle className="w-4 h-4" /> Disconnect Google Calendar
            </>
          )}
        </button>
      ) : (
        <button
          onClick={handleConnect}
          className="w-full flex items-center justify-center gap-2 bg-[#4285F4] text-white font-bold py-3 rounded-xl hover:bg-[#3367d6] transition-colors"
        >
          <Calendar className="w-4 h-4" />
          Connect Google Calendar
        </button>
      )}

      <p className="text-[#525252] text-xs text-center">
        EventSlot only creates and updates events it manages. We never read your other calendar events.
      </p>
    </div>
  );
}
