declare module 'paystack-node' {
  interface PaystackResource {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [method: string]: (...args: any[]) => Promise<any>
  }

  class Paystack {
    constructor(secretKey: string | undefined)
    transaction: PaystackResource
    subscription: PaystackResource
    customer: PaystackResource
    plan: PaystackResource
    charge: PaystackResource
    refund: PaystackResource
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: PaystackResource | any
  }
  export = Paystack
}
