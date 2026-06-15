'use client';

import { useState, useEffect } from 'react';

interface MpesaPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  plan: { name: string; displayName: string; monthlyPriceUsd: number; annualPriceUsd: number };
  billingCycle: 'monthly' | 'annual';
}

export function MpesaPaymentModal({
  isOpen, onClose, onSuccess, plan, billingCycle
}: MpesaPaymentModalProps) {
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<'input' | 'waiting' | 'success' | 'error'>('input');
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [amountKes, setAmountKes] = useState(0);

  const priceUsd = billingCycle === 'annual' ? plan.annualPriceUsd : plan.monthlyPriceUsd;

  // Poll for payment status
  useEffect(() => {
    if (step !== 'waiting' || !checkoutRequestId) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/payments/mpesa/status?checkoutRequestId=${checkoutRequestId}`);
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        clearInterval(interval);
        setStep('success');
        setTimeout(() => { onSuccess(); onClose(); }, 2000);
      } else if (data.status === 'FAILED' || data.status === 'CANCELLED') {
        clearInterval(interval);
        setErrorMessage(data.status === 'CANCELLED' ? 'Payment was cancelled.' : 'Payment failed. Please try again.');
        setStep('error');
      }
    }, 3000); // poll every 3 seconds

    return () => clearInterval(interval);
  }, [step, checkoutRequestId]);

  const handleSubmit = async () => {
    if (!phone.trim()) return;
    setStep('waiting');
    setErrorMessage('');

    try {
      const res = await fetch('/api/payments/mpesa/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planName: plan.name, billingCycle, phone: phone.trim() }),
      });
      const data = await res.json();

      if (!res.ok || !data.checkoutRequestId) {
        setErrorMessage(data.error ?? 'Failed to initiate payment.');
        setStep('error');
        return;
      }

      setCheckoutRequestId(data.checkoutRequestId);
      setAmountKes(data.amountKes);
    } catch {
      setErrorMessage('Network error. Please try again.');
      setStep('error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="bg-[#111111] border border-zinc-800 rounded-2xl w-full max-w-md p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Upgrade to {plan.displayName}
            </h2>
            <p className="text-sm text-zinc-400 mt-0.5">
              {billingCycle === 'annual' ? 'Annual billing' : 'Monthly billing'} · ${priceUsd}
              {billingCycle === 'annual' ? '/year' : '/month'}
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors text-xl">✕</button>
        </div>

        {/* Input step */}
        {step === 'input' && (
          <div className="space-y-4">
            <div className="bg-[#C8F55A]/5 border border-[#C8F55A]/20 rounded-xl p-4">
              <p className="text-sm text-zinc-300 font-medium mb-1">Pay via M-Pesa</p>
              <p className="text-xs text-zinc-500">
                You will receive an STK Push prompt on your phone. Enter your M-Pesa PIN to complete payment.
              </p>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">M-Pesa Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0712 345 678"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#C8F55A] transition-colors"
              />
              <p className="text-xs text-zinc-600 mt-1">Safaricom numbers only (07XX or 01XX)</p>
            </div>
            <button
              onClick={handleSubmit}
              disabled={!phone.trim()}
              className="w-full bg-[#C8F55A] hover:bg-[#b8e84a] disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold py-3 rounded-xl transition-colors"
            >
              Send STK Push — KES ~{Math.ceil(priceUsd * 130).toLocaleString()}
            </button>
            <p className="text-xs text-zinc-600 text-center">
              Amount in KES calculated at current exchange rate
            </p>
          </div>
        )}

        {/* Waiting step */}
        {step === 'waiting' && (
          <div className="text-center py-8 space-y-4">
            <div className="w-14 h-14 rounded-full bg-[#C8F55A]/10 flex items-center justify-center mx-auto">
              <div className="w-7 h-7 border-2 border-[#C8F55A] border-t-transparent rounded-full animate-spin" />
            </div>
            <div>
              <p className="text-white font-medium">Check your phone</p>
              <p className="text-sm text-zinc-400 mt-1">
                An M-Pesa prompt has been sent to <span className="text-white">{phone}</span>.
                Enter your PIN to complete payment.
              </p>
            </div>
            <p className="text-xs text-zinc-600">This page updates automatically. Do not close it.</p>
          </div>
        )}

        {/* Success step */}
        {step === 'success' && (
          <div className="text-center py-8 space-y-3">
            <div className="w-14 h-14 rounded-full bg-[#C8F55A]/20 flex items-center justify-center mx-auto">
              <span className="text-[#C8F55A] text-2xl">✓</span>
            </div>
            <p className="text-white font-semibold text-lg">Payment successful!</p>
            <p className="text-sm text-zinc-400">Your {plan.displayName} plan is now active.</p>
          </div>
        )}

        {/* Error step */}
        {step === 'error' && (
          <div className="space-y-4">
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
              <p className="text-red-400 text-sm">{errorMessage}</p>
            </div>
            <button
              onClick={() => setStep('input')}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl transition-colors"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
