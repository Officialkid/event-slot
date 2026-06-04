/** @jest-environment node */

/**
 * Tests for lib/isAdmin.ts — admin email resolution
 *
 * Environment variables are set in beforeAll() and cleared in afterAll()
 * so they don't bleed into other test files.
 */

import { isAdminEmail, getConfiguredAdminEmails } from '@/lib/isAdmin'

describe('isAdminEmail — single SUPER_ADMIN_EMAIL', () => {
  beforeAll(() => {
    process.env.SUPER_ADMIN_EMAIL = 'admin@eventsslot.com'
    delete process.env.SUPER_ADMIN_EMAIL_2
    delete process.env.SUPER_ADMIN_EMAILS
    delete process.env.PRIVILEGED_ACCOUNT_1
    delete process.env.PRIVILEGED_ACCOUNT_2
  })

  afterAll(() => {
    delete process.env.SUPER_ADMIN_EMAIL
  })

  it('returns true for the exact admin email', () => {
    expect(isAdminEmail('admin@eventsslot.com')).toBe(true)
  })

  it('is case-insensitive (uppercase input)', () => {
    expect(isAdminEmail('ADMIN@EVENTSSLOT.COM')).toBe(true)
  })

  it('is case-insensitive (mixed case)', () => {
    expect(isAdminEmail('Admin@EventsSlot.Com')).toBe(true)
  })

  it('returns false for a non-admin email', () => {
    expect(isAdminEmail('user@example.com')).toBe(false)
  })

  it('returns false for an empty string', () => {
    expect(isAdminEmail('')).toBe(false)
  })

  it('returns false for null', () => {
    expect(isAdminEmail(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isAdminEmail(undefined)).toBe(false)
  })

  it('trims whitespace before comparison', () => {
    // The normalize function trims, so padded emails should still match
    expect(isAdminEmail('  admin@eventsslot.com  ')).toBe(true)
  })
})

describe('isAdminEmail — SUPER_ADMIN_EMAILS (comma/semicolon separated list)', () => {
  beforeAll(() => {
    delete process.env.SUPER_ADMIN_EMAIL
    process.env.SUPER_ADMIN_EMAILS = 'alice@eventsslot.com, bob@eventsslot.com; carol@eventsslot.com'
  })

  afterAll(() => {
    delete process.env.SUPER_ADMIN_EMAILS
  })

  it('accepts the first email in the list', () => {
    expect(isAdminEmail('alice@eventsslot.com')).toBe(true)
  })

  it('accepts an email separated by semicolon', () => {
    expect(isAdminEmail('carol@eventsslot.com')).toBe(true)
  })

  it('accepts an email separated by comma', () => {
    expect(isAdminEmail('bob@eventsslot.com')).toBe(true)
  })

  it('returns false for an email not in the list', () => {
    expect(isAdminEmail('dave@eventsslot.com')).toBe(false)
  })
})

describe('isAdminEmail — PRIVILEGED_ACCOUNT env vars', () => {
  beforeAll(() => {
    delete process.env.SUPER_ADMIN_EMAIL
    delete process.env.SUPER_ADMIN_EMAILS
    process.env.PRIVILEGED_ACCOUNT_1 = 'priv1@eventsslot.com'
    process.env.PRIVILEGED_ACCOUNT_2 = 'priv2@eventsslot.com'
  })

  afterAll(() => {
    delete process.env.PRIVILEGED_ACCOUNT_1
    delete process.env.PRIVILEGED_ACCOUNT_2
  })

  it('accepts PRIVILEGED_ACCOUNT_1', () => {
    expect(isAdminEmail('priv1@eventsslot.com')).toBe(true)
  })

  it('accepts PRIVILEGED_ACCOUNT_2', () => {
    expect(isAdminEmail('priv2@eventsslot.com')).toBe(true)
  })
})

describe('getConfiguredAdminEmails', () => {
  beforeAll(() => {
    process.env.SUPER_ADMIN_EMAIL = 'main@eventsslot.com'
    process.env.SUPER_ADMIN_EMAILS = 'main@eventsslot.com, extra@eventsslot.com'
  })

  afterAll(() => {
    delete process.env.SUPER_ADMIN_EMAIL
    delete process.env.SUPER_ADMIN_EMAILS
  })

  it('returns an array of strings', () => {
    const emails = getConfiguredAdminEmails()
    expect(Array.isArray(emails)).toBe(true)
  })

  it('deduplicates the same email appearing in multiple env vars', () => {
    // main@eventsslot.com appears in both SUPER_ADMIN_EMAIL and SUPER_ADMIN_EMAILS
    const emails = getConfiguredAdminEmails()
    const count = emails.filter((e) => e === 'main@eventsslot.com').length
    expect(count).toBe(1)
  })

  it('normalises emails to lowercase', () => {
    const emails = getConfiguredAdminEmails()
    emails.forEach((e) => expect(e).toBe(e.toLowerCase()))
  })
})
