declare module 'paystack-node' {
  class Paystack {
    constructor(secretKey: string | undefined)
    initializeTransaction(params: Record<string, unknown>): Promise<{ body: Record<string, unknown> }>
    verifyTransaction(params: { reference: string }): Promise<{ body: Record<string, unknown> }>
    createSubscription(params: Record<string, unknown>): Promise<{ body: Record<string, unknown> }>
    disableSubscription(params: Record<string, unknown>): Promise<{ body: Record<string, unknown> }>
    listTransactions(params?: Record<string, unknown>): Promise<{ body: Record<string, unknown> }>
    [key: string]: unknown
  }
  export = Paystack
}
