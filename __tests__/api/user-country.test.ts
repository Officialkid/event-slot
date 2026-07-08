/** @jest-environment node */

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/user/country/route'

const mockGetServerSession = jest.fn()
const mockFindUnique = jest.fn()
const mockUpdate = jest.fn()
const mockDetectCountry = jest.fn()
const mockGetCountryName = jest.fn()

jest.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}))

jest.mock('@/lib/geoip', () => ({
  detectCountry: (...args: unknown[]) => mockDetectCountry(...args),
  getCountryName: (...args: unknown[]) => mockGetCountryName(...args),
}))

describe('GET /api/user/country', () => {
  beforeEach(() => {
    mockGetServerSession.mockReset()
    mockFindUnique.mockReset()
    mockUpdate.mockReset()
    mockDetectCountry.mockReset()
    mockGetCountryName.mockReset()
  })

  it('returns UNKNOWN and does not overwrite stored data when detection fails', async () => {
    mockDetectCountry.mockRejectedValue(new Error('geo lookup failed'))
    mockGetCountryName.mockReturnValue('Unknown')
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } })
    mockFindUnique.mockResolvedValue({
      signupCountry: 'KE',
      countryCode: 'KE',
      countryName: 'Kenya',
    })

    const req = new NextRequest('http://localhost/api/user/country')
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ countryCode: 'UNKNOWN' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('persists a newly detected known country for signed-in users', async () => {
    mockDetectCountry.mockResolvedValue('UG')
    mockGetCountryName.mockReturnValue('Uganda')
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-2' } })
    mockFindUnique.mockResolvedValue({
      signupCountry: null,
      countryCode: null,
      countryName: null,
    })
    mockUpdate.mockResolvedValue(null)

    const req = new NextRequest('http://localhost/api/user/country')
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ countryCode: 'UG' })
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'user-2' },
      data: {
        signupCountry: 'UG',
        countryCode: 'UG',
        countryName: 'Uganda',
      },
    })
  })
})
