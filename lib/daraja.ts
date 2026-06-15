const BASE_URL =
  process.env.DARAJA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

// ── Get OAuth access token ────────────────────────────────────────────────────
export async function getDarajaToken(): Promise<string> {
  const key = process.env.DARAJA_CONSUMER_KEY!;
  const secret = process.env.DARAJA_CONSUMER_SECRET!;
  const credentials = Buffer.from(`${key}:${secret}`).toString('base64');

  const res = await fetch(
    `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    {
      method: 'GET',
      headers: { Authorization: `Basic ${credentials}` },
      // Token is valid 3600s — cache at the call site if needed
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Daraja token error: ${res.status} — ${text}`);
  }

  const data = await res.json();
  return data.access_token as string;
}

// ── Generate STK Push password ────────────────────────────────────────────────
function generatePassword(): { password: string; timestamp: string } {
  const shortcode = process.env.DARAJA_SHORTCODE!;
  const passkey = process.env.DARAJA_PASSKEY!;
  const timestamp = new Date()
    .toISOString()
    .replace(/[-T:.Z]/g, '')
    .slice(0, 14); // YYYYMMDDHHmmss
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
  return { password, timestamp };
}

// ── Normalise phone to 254XXXXXXXXX ──────────────────────────────────────────
export function normaliseMpesaPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) return `254${digits.slice(1)}`;
  if (digits.startsWith('254')) return digits;
  if (digits.startsWith('+254')) return digits.slice(1);
  return digits;
}

// ── Initiate STK Push ─────────────────────────────────────────────────────────
export interface StkPushParams {
  phone: string;         // any Kenyan format — normalised internally
  amountKes: number;     // must be whole number (Daraja requirement)
  accountReference: string;   // shown on M-Pesa prompt, max 12 chars
  transactionDesc: string;    // max 13 chars
}

export interface StkPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export async function initiateStkPush(params: StkPushParams): Promise<StkPushResponse> {
  const token = await getDarajaToken();
  const { password, timestamp } = generatePassword();
  const phone = normaliseMpesaPhone(params.phone);
  const amount = Math.ceil(params.amountKes); // Daraja requires integer

  const payload = {
    BusinessShortCode: process.env.DARAJA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: amount,
    PartyA: phone,
    PartyB: process.env.DARAJA_SHORTCODE,
    PhoneNumber: phone,
    CallBackURL: process.env.DARAJA_CALLBACK_URL,
    AccountReference: params.accountReference.slice(0, 12),
    TransactionDesc: params.transactionDesc.slice(0, 13),
  };

  const res = await fetch(
    `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`STK Push error: ${res.status} — ${text}`);
  }

  return res.json();
}

// ── Query STK Push status ─────────────────────────────────────────────────────
export async function queryStkStatus(checkoutRequestId: string) {
  const token = await getDarajaToken();
  const { password, timestamp } = generatePassword();

  const res = await fetch(
    `${BASE_URL}/mpesa/stkpushquery/v1/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: process.env.DARAJA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      }),
    }
  );

  return res.json();
}
