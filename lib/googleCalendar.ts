// lib/googleCalendar.ts
// Core service for all Google Calendar API operations.
// Handles token refresh, event creation, update, and deletion.

import { google } from 'googleapis';
import { prisma } from './prisma';
import { APP_URL } from './config';

function getCalendarConfig() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';
  const redirectUri =
    process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
    `${APP_URL}/api/auth/google-calendar/callback`;

  return {
    clientId,
    clientSecret,
    redirectUri,
  };
}

// Guard: if Google Calendar is not configured, skip silently
function isCalendarConfigured(): boolean {
  const { clientId, clientSecret, redirectUri } = getCalendarConfig();
  return !!(clientId && clientSecret && redirectUri);
}

// OAuth2 client — singleton factory
function createOAuth2Client() {
  const { clientId, clientSecret, redirectUri } = getCalendarConfig();
  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );
}

// Scopes requested from the user
export const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  // events scope only — we do not read their full calendar or contacts
];

// Generate the OAuth URL — user clicks this to connect Google Calendar
export function getCalendarAuthUrl(userId: string): string {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',  // get refresh token
    prompt:      'consent',  // always show consent screen (ensures refresh token)
    scope:       CALENDAR_SCOPES,
    state:       Buffer.from(JSON.stringify({ userId })).toString('base64'),
  });
}

// Exchange auth code for tokens and store them
export async function connectGoogleCalendar(
  userId:   string,
  authCode: string
): Promise<void> {
  const oauth2Client = createOAuth2Client();
  const { tokens }   = await oauth2Client.getToken(authCode);

  if (!tokens.refresh_token) {
    throw new Error(
      'No refresh token received. User may need to revoke access and reconnect.'
    );
  }

  await prisma.googleCalendarToken.upsert({
    where:  { userId },
    update: {
      accessToken:  tokens.access_token!,
      refreshToken: tokens.refresh_token,
      expiresAt:    new Date(tokens.expiry_date!),
      scope:        tokens.scope ?? '',
      connected:    true,
      lastUsedAt:   new Date(),
    },
    create: {
      userId,
      accessToken:  tokens.access_token!,
      refreshToken: tokens.refresh_token,
      expiresAt:    new Date(tokens.expiry_date!),
      scope:        tokens.scope ?? '',
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data:  { googleCalendarConnected: true },
  });
}

// Get an authenticated Google Calendar client for a user.
// Handles automatic token refresh.
async function getCalendarClient(userId: string) {
  const tokenRecord = await prisma.googleCalendarToken.findUnique({
    where: { userId },
  });

  if (!tokenRecord || !tokenRecord.connected) {
    return null; // user hasn't connected Google Calendar
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token:  tokenRecord.accessToken,
    refresh_token: tokenRecord.refreshToken,
    expiry_date:   tokenRecord.expiresAt.getTime(),
  });

  // Auto-refresh if token is expired or expiring within 5 minutes
  const expiresInMs = tokenRecord.expiresAt.getTime() - Date.now();
  if (expiresInMs < 5 * 60 * 1000) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      await prisma.googleCalendarToken.update({
        where: { userId },
        data: {
          accessToken: credentials.access_token!,
          expiresAt:   new Date(credentials.expiry_date!),
          lastUsedAt:  new Date(),
        },
      });
      oauth2Client.setCredentials(credentials);
    } catch (err) {
      console.error('[calendar] Token refresh failed for user', userId, err);
      // Mark as disconnected so we stop trying
      await prisma.googleCalendarToken.update({
        where: { userId },
        data:  { connected: false },
      });
      return null;
    }
  }

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

// Build the Google Calendar event object from an EventSlot event
function buildCalendarEvent(params: {
  title:        string;
  description:  string;
  location:     string | null;
  startDate:    Date;
  durationMins: number;
  eventUrl:     string;
  isVirtual:    boolean;
  meetingLink?: string | null;
}) {
  const endDate = new Date(params.startDate.getTime() + params.durationMins * 60_000);

  return {
    summary:     params.title,
    description: [
      params.description,
      '',
      `Event page: ${params.eventUrl}`,
      params.meetingLink ? `Meeting link: ${params.meetingLink}` : '',
    ].filter(Boolean).join('\n'),
    location: params.location ?? (params.isVirtual ? 'Online' : undefined),
    start: {
      dateTime: params.startDate.toISOString(),
      timeZone: 'Africa/Nairobi',
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: 'Africa/Nairobi',
    },
    ...(params.meetingLink ? {
      conferenceData: {
        entryPoints: [{
          entryPointType: 'video',
          uri:            params.meetingLink,
          label:          'Join meeting',
        }],
      },
    } : {}),
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 }, // 1 day before
        { method: 'popup', minutes: 60 },       // 1 hour before
        { method: 'popup', minutes: 15 },       // 15 mins before
      ],
    },
    source: {
      title: 'EventSlot',
      url:   params.eventUrl,
    },
  };
}

// CREATE — push an event to a user's Google Calendar
export async function createCalendarEvent(params: {
  userId:       string;
  eventSlotId:  string;
  role:         'organiser' | 'attendee';
  title:        string;
  description:  string;
  location:     string | null;
  startDate:    Date;
  durationMins: number;
  eventUrl:     string;
  isVirtual:    boolean;
  meetingLink?: string | null;
}): Promise<{ success: boolean; googleEventId?: string }> {
  if (!isCalendarConfigured()) return { success: false };
  const calendar = await getCalendarClient(params.userId);
  if (!calendar) return { success: false };

  try {
    const response = await calendar.events.insert({
      calendarId:            'primary',
      conferenceDataVersion: params.isVirtual ? 1 : 0,
      requestBody:           buildCalendarEvent(params),
    });

    const googleEventId = response.data.id!;

    await prisma.calendarEventSync.upsert({
      where: {
        userId_eventId_role: {
          userId:  params.userId,
          eventId: params.eventSlotId,
          role:    params.role,
        },
      },
      update: {
        googleEventId,
        syncStatus:   'synced',
        lastSyncedAt: new Date(),
      },
      create: {
        userId:       params.userId,
        eventId:      params.eventSlotId,
        googleEventId,
        role:         params.role,
        syncStatus:   'synced',
      },
    });

    return { success: true, googleEventId };
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    console.error('[calendar] Failed to create event for user', params.userId, e.message);

    if (e.code === 401 || e.code === 403) {
      await prisma.googleCalendarToken.update({
        where: { userId: params.userId },
        data:  { connected: false },
      });
    }

    return { success: false };
  }
}

// UPDATE — sync changes to an existing calendar event
export async function updateCalendarEvent(params: {
  userId:       string;
  eventSlotId:  string;
  role:         'organiser' | 'attendee';
  title:        string;
  description:  string;
  location:     string | null;
  startDate:    Date;
  durationMins: number;
  eventUrl:     string;
  isVirtual:    boolean;
  meetingLink?: string | null;
}): Promise<{ success: boolean }> {
  if (!isCalendarConfigured()) return { success: false };
  const calendar = await getCalendarClient(params.userId);
  if (!calendar) return { success: false };

  const syncRecord = await prisma.calendarEventSync.findUnique({
    where: {
      userId_eventId_role: {
        userId:  params.userId,
        eventId: params.eventSlotId,
        role:    params.role,
      },
    },
  });

  if (!syncRecord) {
    // No existing sync — create it instead
    return createCalendarEvent(params);
  }

  try {
    await calendar.events.patch({
      calendarId:  'primary',
      eventId:     syncRecord.googleEventId,
      requestBody: buildCalendarEvent(params),
    });

    await prisma.calendarEventSync.update({
      where: { id: syncRecord.id },
      data:  { syncStatus: 'synced', lastSyncedAt: new Date() },
    });

    return { success: true };
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    console.error('[calendar] Failed to update event', e.message);

    if (e.code === 404) {
      // Event was deleted from Google Calendar — recreate it
      await prisma.calendarEventSync.delete({ where: { id: syncRecord.id } });
      return createCalendarEvent(params);
    }

    return { success: false };
  }
}

// CANCEL — mark the event as cancelled in Google Calendar
// (we update rather than delete so the user sees it was cancelled)
export async function cancelCalendarEvent(params: {
  userId:      string;
  eventSlotId: string;
  role:        'organiser' | 'attendee';
  eventTitle:  string;
}): Promise<{ success: boolean }> {
  if (!isCalendarConfigured()) return { success: false };
  const calendar = await getCalendarClient(params.userId);
  if (!calendar) return { success: false };

  const syncRecord = await prisma.calendarEventSync.findUnique({
    where: {
      userId_eventId_role: {
        userId:  params.userId,
        eventId: params.eventSlotId,
        role:    params.role,
      },
    },
  });

  if (!syncRecord) return { success: true }; // nothing to cancel

  try {
    await calendar.events.patch({
      calendarId:  'primary',
      eventId:     syncRecord.googleEventId,
      requestBody: {
        summary: `[CANCELLED] ${params.eventTitle}`,
        status:  'cancelled',
        colorId: '11', // red in Google Calendar
      },
    });

    await prisma.calendarEventSync.update({
      where: { id: syncRecord.id },
      data:  { syncStatus: 'synced', lastSyncedAt: new Date() },
    });

    return { success: true };
  } catch (err) {
    console.error('[calendar] Failed to cancel event', err);
    return { success: false };
  }
}

// DELETE — fully remove from Google Calendar
export async function removeCalendarEvent(params: {
  userId:      string;
  eventSlotId: string;
  role:        'organiser' | 'attendee';
}): Promise<{ success: boolean }> {
  if (!isCalendarConfigured()) return { success: false };
  const calendar = await getCalendarClient(params.userId);
  if (!calendar) return { success: false };

  const syncRecord = await prisma.calendarEventSync.findUnique({
    where: {
      userId_eventId_role: {
        userId:  params.userId,
        eventId: params.eventSlotId,
        role:    params.role,
      },
    },
  });

  if (!syncRecord) return { success: true };

  try {
    await calendar.events.delete({
      calendarId: 'primary',
      eventId:    syncRecord.googleEventId,
    });
    await prisma.calendarEventSync.delete({ where: { id: syncRecord.id } });
    return { success: true };
  } catch (err: unknown) {
    const e = err as { code?: number };
    if (e.code === 404) {
      // Already gone from Google Calendar — clean up our record
      await prisma.calendarEventSync.delete({ where: { id: syncRecord.id } });
      return { success: true };
    }
    return { success: false };
  }
}

// Check if a user has Google Calendar connected
export async function isCalendarConnected(userId: string): Promise<boolean> {
  const token = await prisma.googleCalendarToken.findUnique({
    where:  { userId },
    select: { connected: true },
  });
  return token?.connected ?? false;
}

// Disconnect Google Calendar — revoke our access and clear tokens
export async function disconnectGoogleCalendar(userId: string): Promise<void> {
  const token = await prisma.googleCalendarToken.findUnique({
    where:  { userId },
    select: { accessToken: true },
  });

  if (token?.accessToken) {
    try {
      const oauth2Client = createOAuth2Client();
      await oauth2Client.revokeToken(token.accessToken);
    } catch {
      // Revocation may fail if token is already expired — that's fine
    }
  }

  await prisma.googleCalendarToken.update({
    where: { userId },
    data:  { connected: false },
  });

  await prisma.user.update({
    where: { id: userId },
    data:  { googleCalendarConnected: false },
  });
}

export { isCalendarConfigured };
