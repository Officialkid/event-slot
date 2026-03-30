// ── Event ──────────────────────────────────────────────────────────────────

export type EventStatus = 'active' | 'closed' | 'cancelled';

export interface Event {
  id: string;
  title: string;
  slug: string;
  description?: string;
  date?: Date;
  location?: string;
  capacity?: number;           // undefined = unlimited
  status: EventStatus;
  organizerEmail: string;
  dashboardToken: string;      // secret token for organizer dashboard access
  createdAt: Date;
  updatedAt: Date;
}

// ── Registration ───────────────────────────────────────────────────────────

export type RegistrationStatus = 'confirmed' | 'waitlisted' | 'cancelled';

export interface Registration {
  id: string;
  eventId: string;
  name: string;
  email: string;
  status: RegistrationStatus;
  position: number;            // overall sign-up order (1-based)
  createdAt: Date;
  updatedAt: Date;
}

// ── API payloads ────────────────────────────────────────────────────────────

export interface CreateEventInput {
  title: string;
  slug: string;
  description?: string;
  date?: string;               // ISO string from form
  location?: string;
  capacity?: number;
  organizerEmail: string;
}

export interface RegisterInput {
  eventSlug: string;
  name: string;
  email: string;
}

// ── API responses ───────────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
