// Cashfree's checkout script, served from Cashfree's CDN. Loaded on first use (when someone buys a pass)
// instead of on every page.
export type CheckoutResult = { error?: { message?: string }; redirect?: boolean; paymentDetails?: { paymentMessage?: string } };
type Checkout = { checkout(o: { paymentSessionId: string; redirectTarget: "_modal" }): Promise<CheckoutResult> };
type CashfreeFactory = (o: { mode: "sandbox" | "production" }) => Checkout;

declare global {
  interface Window { Cashfree?: CashfreeFactory }
}

let loading: Promise<CashfreeFactory> | null = null;

export function loadCashfree(): Promise<CashfreeFactory> {
  loading ??= new Promise<CashfreeFactory>((resolve, reject) => {
    const fail = () => {
      loading = null; // let the next click try again
      reject(new Error("The payment window could not load. Check your connection and try again."));
    };
    const s = document.createElement("script");
    s.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    s.onload = () => (window.Cashfree ? resolve(window.Cashfree) : fail());
    s.onerror = fail;
    document.head.appendChild(s);
  });
  return loading;
}
