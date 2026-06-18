import prisma from '@/lib/prisma'
import {
  activateSubscriptionPayment,
  failPaidEventOrderPayment,
  failSubscriptionPayment,
  finalizePaidEventOrderPayment,
} from '@/lib/paymentFinalizers'

export type MpesaCallbackItem = {
  Name?: string
  Value?: string | number | null
}

export type MpesaStkCallback = {
  CheckoutRequestID?: string
  ResultCode?: number
  ResultDesc?: string
  CallbackMetadata?: {
    Item?: MpesaCallbackItem[]
  }
}

export type MpesaCallbackBody = {
  Body?: {
    stkCallback?: MpesaStkCallback
  }
}

export function getCallbackItems(metadata?: { Item?: MpesaCallbackItem[] }) {
  return Array.isArray(metadata?.Item) ? metadata.Item : []
}

export function getItemValue(items: MpesaCallbackItem[], name: string) {
  return items.find((item) => item.Name === name)?.Value
}

export async function processMpesaCallback(body: MpesaCallbackBody | null) {
  const stkCallback = body?.Body?.stkCallback
  if (!stkCallback) {
    return { handled: false as const, scope: 'none' as const }
  }

  const checkoutRequestId =
    typeof stkCallback.CheckoutRequestID === 'string' ? stkCallback.CheckoutRequestID : ''
  const resultCode = typeof stkCallback.ResultCode === 'number' ? stkCallback.ResultCode : -1
  const callbackItems = getCallbackItems(stkCallback.CallbackMetadata)
  const receiptValue = getItemValue(callbackItems, 'MpesaReceiptNumber')
  const receiptNumber = receiptValue == null ? null : String(receiptValue)

  const eventOrder = await prisma.paidEventOrder.findFirst({
    where: { checkoutRequestId },
    select: {
      id: true,
      status: true,
    },
  })

  if (eventOrder) {
    if (eventOrder.status === 'PAID') {
      return { handled: true as const, scope: 'paid-event' as const, status: 'PAID' as const, duplicate: true }
    }

    if (resultCode !== 0) {
      await prisma.errorLog.create({
        data: {
          route: `mpesa-callback:${eventOrder.id}`,
          message: JSON.stringify({
            checkoutRequestId,
            resultCode,
            resultDesc: stkCallback.ResultDesc ?? null,
            createdAt: new Date().toISOString(),
          }),
        },
      }).catch(() => {})
      await failPaidEventOrderPayment(eventOrder.id, resultCode === 1032 ? 'CANCELLED' : 'FAILED')
      return {
        handled: true as const,
        scope: 'paid-event' as const,
        status: resultCode === 1032 ? 'CANCELLED' as const : 'FAILED' as const,
        duplicate: false,
      }
    }

    await finalizePaidEventOrderPayment(eventOrder.id, receiptNumber)
    await prisma.errorLog.create({
      data: {
        route: `mpesa-callback:${eventOrder.id}`,
        message: JSON.stringify({
          checkoutRequestId,
          resultCode,
          resultDesc: stkCallback.ResultDesc ?? null,
          receiptNumber,
          createdAt: new Date().toISOString(),
        }),
      },
    }).catch(() => {})
    return { handled: true as const, scope: 'paid-event' as const, status: 'PAID' as const, duplicate: false }
  }

  const payment = await prisma.subscriptionPayment.findFirst({
    where: { checkoutRequestId },
    select: { id: true, status: true },
  })

  if (!payment) {
    console.error('Callback: no payment found for', checkoutRequestId)
    return { handled: false as const, scope: 'none' as const }
  }

  if (payment.status === 'SUCCESS') {
    return { handled: true as const, scope: 'subscription' as const, status: 'SUCCESS' as const, duplicate: true }
  }

  if (resultCode !== 0) {
    await failSubscriptionPayment(payment.id, resultCode === 1032 ? 'CANCELLED' : 'FAILED')
    return {
      handled: true as const,
      scope: 'subscription' as const,
      status: resultCode === 1032 ? 'CANCELLED' as const : 'FAILED' as const,
      duplicate: false,
    }
  }

  await activateSubscriptionPayment(payment.id, receiptNumber)
  return { handled: true as const, scope: 'subscription' as const, status: 'SUCCESS' as const, duplicate: false }
}
