import { useState, useMemo } from 'react';
import { AppHeader } from '../components/AppHeader';
import { Panel } from '../components/Panel';
import { Metric } from '../components/Primitives';
import { useFleet } from '../store/FleetContext';
import { api } from '../lib/api';
import { cn, formatTime } from '../lib/format';
import type { Payment, Shipment } from '../lib/types';

export function PaymentsView() {
  const { snapshot, refresh } = useFleet();
  const { shipments, payments = [] } = snapshot;

  // Selected shipment for payment
  const unconfirmedShipments = useMemo(
    () => shipments.filter((s: Shipment) => s.status === 'CAPACITY_RESERVED' || s.status === 'DRAFT'),
    [shipments],
  );

  const [selectedShipmentId, setSelectedShipmentId] = useState<string>(
    unconfirmedShipments[0]?.id || shipments[0]?.id || '',
  );

  const selectedShipment = shipments.find((s: Shipment) => s.id === selectedShipmentId) || shipments[0] || null;

  // Form states
  const [customerName, setCustomerName] = useState('ABC Distributors Ltd.');
  const [customerEmail, setCustomerEmail] = useState('billing@abcdistributors.in');
  const [paymentMethod, setPaymentMethod] = useState<'DODO_CHECKOUT' | 'UPI_QR' | 'CARD'>('DODO_CHECKOUT');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<Payment | null>(null);
  const [checkoutSession, setCheckoutSession] = useState<{ checkoutUrl: string; paymentId: string; isSandbox: boolean } | null>(null);
  const [showSimModal, setShowSimModal] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'PAID' | 'PENDING'>('ALL');

  // Pricing breakdown
  const baseRate = selectedShipment?.price || 1700;
  const tollSurcharge = Math.round(baseRate * 0.08); // 8% FASTag toll estimate
  const platformEscrowFee = 150;
  const gst = Math.round((baseRate + tollSurcharge + platformEscrowFee) * 0.18);
  const totalAmount = baseRate + tollSurcharge + platformEscrowFee + gst;

  // Metrics
  const totalSettled = payments
    .filter((p: Payment) => p.status === 'PAID')
    .reduce((acc: number, p: Payment) => acc + p.amount, 0);

  const pendingCount = payments.filter((p: Payment) => p.status === 'PENDING').length;
  const paidCount = payments.filter((p: Payment) => p.status === 'PAID').length;

  const filteredPayments = useMemo(() => {
    if (filter === 'ALL') return payments;
    return payments.filter((p: Payment) => p.status === filter);
  }, [payments, filter]);

  // Initiate Dodo Checkout Session
  const handleInitiatePayment = async () => {
    setIsProcessing(true);
    try {
      const res = await api.createDodoCheckout({
        shipmentId: selectedShipment?.id ?? null,
        amount: totalAmount,
        currency: 'INR',
        customerName,
        customerEmail,
      });

      setCheckoutSession({
        checkoutUrl: res.checkoutUrl,
        paymentId: res.payment.id,
        isSandbox: res.isSandbox,
      });
      setShowSimModal(true);
      await refresh();
    } catch (err) {
      alert((err as Error).message || 'Failed to initialize Dodo Payments');
    } finally {
      setIsProcessing(false);
    }
  };

  // Complete Payment (Webhook / 3DS return simulation)
  const handleConfirmPayment = async (paymentId: string) => {
    setIsProcessing(true);
    try {
      const res = await api.confirmDodoPayment({
        paymentId,
        providerReference: `dodo_ch_${Math.random().toString(36).substring(2, 9)}`,
        paymentMethod: paymentMethod === 'UPI_QR' ? 'UPI / BharatQR' : paymentMethod === 'CARD' ? 'Visa / Mastercard' : 'Dodo Hosted Checkout',
      });

      setShowSimModal(false);
      setCheckoutSession(null);
      setActiveReceipt(res.payment);
      await refresh();
    } catch (err) {
      alert((err as Error).message || 'Failed to complete payment confirmation');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="relative z-10 min-h-screen bg-base-950 text-ink-100">
      <AppHeader />

      <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-4 lg:px-6">
        {/* Title & Brand Section */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-ink-50">Dodo Payments Hub</h1>
              <span className="rounded-full border border-healthy/40 bg-healthy/10 px-2.5 py-0.5 font-mono text-2xs font-semibold text-healthy">
                Production Gateway
              </span>
            </div>
            <p className="mt-0.5 text-xs text-ink-400">
              Deterministic escrow settlement, instant multi-device webhook verification & cargo confirmation
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-md border border-base-600 bg-base-850 px-3 py-1.5 font-mono text-2xs text-ink-300">
              <svg className="h-3.5 w-3.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
              Provider: Dodo Payments (INR / USD)
            </span>
          </div>
        </div>

        {/* Top Operational Metrics */}
        <div className="panel grid grid-cols-2 divide-x divide-base-600 sm:grid-cols-4">
          <Metric label="Total Settled" value={`₹${totalSettled.toLocaleString('en-IN')}`} tone="healthy" hint="Disbursed to carriers" />
          <Metric label="Paid Invoices" value={paidCount} tone="accent" hint="Authoritative receipts" />
          <Metric label="Awaiting Payment" value={pendingCount} tone="warn" hint="Active reservations" />
          <Metric label="Escrow SLA" value="Instant" tone="neutral" hint="Zero settlement delay" />
        </div>

        {/* Workspace: Checkout & Payment Terminal */}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(380px,0.95fr)]">
          {/* Left Column: Shipment & Bill of Lading Checkout */}
          <div className="space-y-4">
            <Panel
              eyebrow="Payment Terminal"
              title="Freight Capacity Settlement"
              actions={
                <span className="font-mono text-2xs text-healthy">
                  ● Ready for checkout
                </span>
              }
            >
              <div className="space-y-4 p-5">
                {/* Select Shipment */}
                <div>
                  <label className="block font-mono text-2xs font-semibold uppercase tracking-wider text-ink-400">
                    Select Shipment / Bill of Lading
                  </label>
                  <select
                    value={selectedShipmentId}
                    onChange={(e) => setSelectedShipmentId(e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-base-600 bg-base-900 px-3.5 py-2.5 text-xs font-mono text-ink-100 focus:border-accent focus:outline-none"
                  >
                    {shipments.map((s: Shipment) => (
                      <option key={s.id} value={s.id}>
                        {s.id} — {s.cargoName} ({s.origin} → {s.destination}, {s.weightT}T) — [Status: {s.status}]
                      </option>
                    ))}
                  </select>
                </div>

                {/* Shipment Summary Card */}
                {selectedShipment && (
                  <div className="rounded-lg border border-base-700 bg-base-850 p-4">
                    <div className="flex items-center justify-between border-b border-base-700 pb-3">
                      <div>
                        <span className="font-mono text-xs font-bold text-accent">{selectedShipment.id}</span>
                        <span className="ml-2 font-mono text-2xs text-ink-400">{selectedShipment.reference}</span>
                      </div>
                      <span
                        className={cn(
                          'rounded px-2 py-0.5 font-mono text-2xs font-semibold uppercase',
                          selectedShipment.status === 'CONFIRMED' || selectedShipment.status === 'IN_TRANSIT'
                            ? 'bg-healthy/20 text-healthy border border-healthy/40'
                            : 'bg-warn/20 text-warn border border-warn/40',
                        )}
                      >
                        {selectedShipment.status}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 font-mono text-2xs sm:grid-cols-4">
                      <div>
                        <div className="text-ink-500">CARGO</div>
                        <div className="mt-0.5 font-semibold text-ink-100">{selectedShipment.cargoName}</div>
                      </div>
                      <div>
                        <div className="text-ink-500">ROUTE</div>
                        <div className="mt-0.5 font-semibold text-ink-100">
                          {selectedShipment.origin} → {selectedShipment.destination}
                        </div>
                      </div>
                      <div>
                        <div className="text-ink-500">WEIGHT</div>
                        <div className="mt-0.5 font-semibold text-ink-100">{selectedShipment.weightT} Tonnes</div>
                      </div>
                      <div>
                        <div className="text-ink-500">ASSIGNED TRUCK</div>
                        <div className="mt-0.5 font-semibold text-accent">{selectedShipment.truckId || 'FG-027'}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Customer Details */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block font-mono text-2xs font-semibold uppercase tracking-wider text-ink-400">
                      Shipper Company
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="mt-1 w-full rounded-md border border-base-600 bg-base-900 px-3 py-2 text-xs text-ink-100 focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-2xs font-semibold uppercase tracking-wider text-ink-400">
                      Billing Email
                    </label>
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="mt-1 w-full rounded-md border border-base-600 bg-base-900 px-3 py-2 text-xs text-ink-100 focus:border-accent focus:outline-none"
                    />
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div>
                  <label className="block font-mono text-2xs font-semibold uppercase tracking-wider text-ink-400">
                    Payment Method
                  </label>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('DODO_CHECKOUT')}
                      className={cn(
                        'flex flex-col items-center justify-center rounded-lg border p-3 text-center transition-all',
                        paymentMethod === 'DODO_CHECKOUT'
                          ? 'border-accent bg-accent/10 text-accent font-semibold'
                          : 'border-base-700 bg-base-850 text-ink-400 hover:border-base-600',
                      )}
                    >
                      <span className="text-base">🦤</span>
                      <span className="mt-1 font-mono text-2xs">Dodo Checkout</span>
                      <span className="text-[9px] text-ink-500">All-in-One</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('UPI_QR')}
                      className={cn(
                        'flex flex-col items-center justify-center rounded-lg border p-3 text-center transition-all',
                        paymentMethod === 'UPI_QR'
                          ? 'border-accent bg-accent/10 text-accent font-semibold'
                          : 'border-base-700 bg-base-850 text-ink-400 hover:border-base-600',
                      )}
                    >
                      <span className="text-base">📱</span>
                      <span className="mt-1 font-mono text-2xs">UPI / QR Code</span>
                      <span className="text-[9px] text-ink-500">GPay, PhonePe</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('CARD')}
                      className={cn(
                        'flex flex-col items-center justify-center rounded-lg border p-3 text-center transition-all',
                        paymentMethod === 'CARD'
                          ? 'border-accent bg-accent/10 text-accent font-semibold'
                          : 'border-base-700 bg-base-850 text-ink-400 hover:border-base-600',
                      )}
                    >
                      <span className="text-base">💳</span>
                      <span className="mt-1 font-mono text-2xs">Debit / Credit</span>
                      <span className="text-[9px] text-ink-500">Visa, Mastercard</span>
                    </button>
                  </div>
                </div>

                {/* Itemized Cost Breakdown */}
                <div className="rounded-lg border border-base-700 bg-base-900 p-4 font-mono text-xs">
                  <div className="text-2xs font-semibold uppercase tracking-wider text-ink-400">
                    Itemized Cost Breakdown
                  </div>
                  <div className="mt-2.5 space-y-1.5 divide-y divide-base-800">
                    <div className="flex justify-between text-ink-300">
                      <span>Line-Haul Freight (Base)</span>
                      <span>₹{baseRate.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between pt-1.5 text-ink-300">
                      <span>FASTag Electronic Tollway Surcharge</span>
                      <span>₹{tollSurcharge.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between pt-1.5 text-ink-300">
                      <span>FleetGrid Escrow Protection Fee</span>
                      <span>₹{platformEscrowFee.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between pt-1.5 text-ink-300">
                      <span>Integrated GST (18%)</span>
                      <span>₹{gst.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between pt-2 text-sm font-bold text-ink-50">
                      <span>Total Amount Payable</span>
                      <span className="text-healthy">₹{totalAmount.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* Primary CTA */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleInitiatePayment}
                    className="flex-1 rounded-lg bg-healthy px-4 py-3 font-mono text-xs font-bold tracking-wider text-base-950 uppercase shadow-md transition-all hover:bg-healthy/90 active:scale-[0.99] disabled:opacity-50"
                  >
                    {isProcessing ? 'Connecting to Dodo Payments…' : `Pay ₹${totalAmount.toLocaleString('en-IN')} via Dodo`}
                  </button>
                </div>
              </div>
            </Panel>
          </div>

          {/* Right Column: Ledger / Historical Payments */}
          <div className="space-y-4">
            <Panel
              eyebrow="Audit Trail"
              title="Settled Transactions"
              actions={
                <div className="flex items-center gap-1 rounded bg-base-850 p-0.5 font-mono text-3xs">
                  {(['ALL', 'PAID', 'PENDING'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setFilter(tab)}
                      className={cn(
                        'rounded px-2 py-0.5 uppercase tracking-wider',
                        filter === tab ? 'bg-accent text-base-950 font-bold' : 'text-ink-400 hover:text-ink-200',
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              }
              bodyClassName="p-0"
            >
              <div className="max-h-[560px] divide-y divide-base-700/60 overflow-y-auto">
                {filteredPayments.length === 0 ? (
                  <div className="p-8 text-center font-mono text-xs text-ink-500">
                    No transactions recorded for this filter.
                  </div>
                ) : (
                  filteredPayments.map((p: Payment) => (
                    <div
                      key={p.id}
                      className="p-3.5 transition-colors hover:bg-base-850/60"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-ink-100">
                              ₹{p.amount.toLocaleString('en-IN')}
                            </span>
                            <span
                              className={cn(
                                'rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase',
                                p.status === 'PAID'
                                  ? 'bg-healthy/20 text-healthy border border-healthy/40'
                                  : 'bg-warn/20 text-warn border border-warn/40',
                              )}
                            >
                              {p.status}
                            </span>
                          </div>
                          <div className="mt-1 font-mono text-2xs text-ink-400">
                            ID: {p.id} · {p.shipmentId ? `Shipment ${p.shipmentId}` : 'Direct Escrow'}
                          </div>
                          {p.customerName && (
                            <div className="text-2xs text-ink-400">
                              {p.customerName}
                            </div>
                          )}
                        </div>

                        <div className="text-right">
                          <button
                            type="button"
                            onClick={() => setActiveReceipt(p)}
                            className="rounded border border-base-600 bg-base-800 px-2 py-1 font-mono text-3xs font-semibold uppercase tracking-wider text-accent transition-colors hover:bg-base-700"
                          >
                            Receipt ↗
                          </button>
                          <div className="mt-1 font-mono text-[10px] text-ink-500">
                            {formatTime(p.createdAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Panel>
          </div>
        </div>
      </main>

      {/* Dodo Checkout Simulation / Modal */}
      {showSimModal && checkoutSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-base-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-accent/40 bg-base-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-base-700 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🦤</span>
                <div>
                  <h3 className="font-mono text-sm font-bold text-ink-50">Dodo Payments Checkout</h3>
                  <p className="text-2xs text-ink-400">Secure Escrow Session</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSimModal(false)}
                className="text-ink-400 hover:text-ink-100"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 font-mono text-xs">
              <div className="rounded-lg border border-base-700 bg-base-850 p-3.5">
                <div className="flex justify-between text-ink-400">
                  <span>Merchant:</span>
                  <span className="font-semibold text-ink-100">FleetGrid Logistics Inc.</span>
                </div>
                <div className="mt-1 flex justify-between text-ink-400">
                  <span>Customer:</span>
                  <span className="font-semibold text-ink-100">{customerName}</span>
                </div>
                <div className="mt-1 flex justify-between text-ink-400">
                  <span>Shipment Reference:</span>
                  <span className="font-semibold text-accent">{selectedShipment?.id}</span>
                </div>
                <div className="mt-2 border-t border-base-700 pt-2 flex justify-between text-sm font-bold text-healthy">
                  <span>Total Due:</span>
                  <span>₹{totalAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Method-specific visual simulation */}
              {paymentMethod === 'UPI_QR' ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-base-600 bg-base-950 p-4">
                  <div className="h-32 w-32 rounded bg-white p-2 text-center text-base-950 flex flex-col justify-center items-center">
                    <svg viewBox="0 0 100 100" className="h-28 w-28 text-base-950" fill="currentColor">
                      <rect x="10" y="10" width="30" height="30" />
                      <rect x="60" y="10" width="30" height="30" />
                      <rect x="10" y="60" width="30" height="30" />
                      <rect x="50" y="50" width="10" height="10" />
                      <rect x="70" y="70" width="20" height="20" />
                      <rect x="50" y="70" width="10" height="10" />
                      <rect x="70" y="50" width="10" height="10" />
                    </svg>
                  </div>
                  <span className="mt-2 text-2xs text-ink-400">Scan with any UPI App (GPay / PhonePe / Paytm)</span>
                </div>
              ) : paymentMethod === 'CARD' ? (
                <div className="space-y-2 rounded-lg border border-base-700 bg-base-950 p-3.5">
                  <div>
                    <label className="text-3xs uppercase text-ink-400">Card Number</label>
                    <input
                      type="text"
                      readOnly
                      value="4242 •••• •••• 4242"
                      className="mt-0.5 w-full rounded border border-base-700 bg-base-900 px-2 py-1 text-2xs font-mono text-ink-200"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-3xs uppercase text-ink-400">Expiry</label>
                      <input
                        type="text"
                        readOnly
                        value="12/28"
                        className="mt-0.5 w-full rounded border border-base-700 bg-base-900 px-2 py-1 text-2xs font-mono text-ink-200"
                      />
                    </div>
                    <div>
                      <label className="text-3xs uppercase text-ink-400">CVC</label>
                      <input
                        type="text"
                        readOnly
                        value="888"
                        className="mt-0.5 w-full rounded border border-base-700 bg-base-900 px-2 py-1 text-2xs font-mono text-ink-200"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-accent/20 bg-accent/5 p-3 text-center">
                  <span className="text-2xs text-ink-300">
                    Direct integration link ready:
                  </span>
                  <div className="mt-1 truncate font-mono text-3xs text-accent">
                    {checkoutSession.checkoutUrl}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleConfirmPayment(checkoutSession.paymentId)}
                  className="w-full rounded-lg bg-healthy px-4 py-2.5 font-mono text-xs font-bold text-base-950 uppercase shadow-md transition-all hover:bg-healthy/90 active:scale-[0.99] cursor-pointer"
                >
                  {isProcessing ? 'Authorizing & Settling…' : `Authorize & Settle ₹${totalAmount.toLocaleString('en-IN')} via Dodo`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Official Receipt Modal */}
      {activeReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-base-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-healthy/40 bg-base-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-base-700 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-healthy text-base-950 text-xs font-bold">
                  ✓
                </span>
                <h3 className="font-mono text-sm font-bold text-ink-50">Official Payment Receipt</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveReceipt(null)}
                className="text-ink-400 hover:text-ink-100"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 font-mono text-xs">
              <div className="rounded-lg border border-base-700 bg-base-850 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-2xs uppercase text-ink-400">Total Settled</span>
                  <span className="text-lg font-bold text-healthy">
                    ₹{activeReceipt.amount.toLocaleString('en-IN')} {activeReceipt.currency}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-2xs">
                  <div>
                    <span className="text-ink-500">TRANSACTION ID</span>
                    <div className="font-semibold text-ink-200">{activeReceipt.id}</div>
                  </div>
                  <div>
                    <span className="text-ink-500">DODO REFERENCE</span>
                    <div className="font-semibold text-accent">{activeReceipt.providerReference}</div>
                  </div>
                  <div>
                    <span className="text-ink-500">STATUS</span>
                    <div className="font-semibold text-healthy">{activeReceipt.status}</div>
                  </div>
                  <div>
                    <span className="text-ink-500">SETTLED AT</span>
                    <div className="font-semibold text-ink-200">{formatTime(activeReceipt.updatedAt)}</div>
                  </div>
                  <div>
                    <span className="text-ink-500">SHIPMENT</span>
                    <div className="font-semibold text-ink-200">{activeReceipt.shipmentId || 'N/A'}</div>
                  </div>
                  <div>
                    <span className="text-ink-500">PAYMENT METHOD</span>
                    <div className="font-semibold text-ink-200">{activeReceipt.paymentMethod || 'Dodo Payments'}</div>
                  </div>
                </div>
              </div>

              <div className="rounded border border-healthy/30 bg-healthy/5 p-3 text-2xs text-healthy">
                ✓ Cargo capacity has been authoritatively locked. The linked shipment has transitioned to <strong>CONFIRMED</strong> on all driver and control tower dashboards.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded border border-base-600 bg-base-800 px-4 py-2 font-mono text-2xs uppercase tracking-wider text-ink-200 hover:bg-base-700"
                >
                  Print Invoice
                </button>
                <button
                  type="button"
                  onClick={() => setActiveReceipt(null)}
                  className="rounded bg-accent px-4 py-2 font-mono text-2xs font-bold uppercase tracking-wider text-base-950 hover:bg-accent/90"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
