/** @jest-environment node */

import { NextRequest } from 'next/server'
import { PATCH } from '@/app/api/registrations/[registrationId]/route'

const mockRegistrationFindUnique = jest.fn()
const mockRegistrationFindMany = jest.fn()
const mockRegistrationUpdate = jest.fn()

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    registration: {
      findUnique: (...args: unknown[]) => mockRegistrationFindUnique(...args),
      findMany: (...args: unknown[]) => mockRegistrationFindMany(...args),
      update: (...args: unknown[]) => mockRegistrationUpdate(...args),
    },
  },
}))

describe('PATCH /api/registrations/[registrationId] limited options', () => {
  beforeEach(() => {
    mockRegistrationFindUnique.mockReset()
    mockRegistrationFindMany.mockReset()
    mockRegistrationUpdate.mockReset()
  })

  it('rejects edits when a limited option is already full', async () => {
    mockRegistrationFindUnique.mockResolvedValue({
      id: 'reg-1',
      eventId: 'event-1',
      status: 'confirmed',
      event: {
        id: 'event-1',
        status: 'active',
        archived: false,
        deadline: null,
        questions: [
          {
            id: 'role',
            label: 'Preferred Position',
            type: 'select',
            required: true,
            options: ['Media', 'Protocol'],
            optionLimits: { Media: 1 },
          },
        ],
      },
    })

    mockRegistrationFindMany.mockResolvedValue([
      {
        answers: [{ questionId: 'role', value: 'Media' }],
      },
    ])

    const response = await PATCH(
      new NextRequest('http://localhost/api/registrations/reg-1', {
        method: 'PATCH',
        body: JSON.stringify({
          answers: [{ questionId: 'role', value: 'Media' }],
        }),
      }),
      { params: Promise.resolve({ registrationId: 'reg-1' }) }
    )
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toContain('"Media" is already full')
    expect(mockRegistrationUpdate).not.toHaveBeenCalled()
  })
})
