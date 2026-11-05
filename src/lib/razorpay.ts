// Razorpay's Checkout script, served from Razorpay's CDN. Loaded on first use (when someone pays with
// Razorpay) instead of on every page. It opens the payment window over the page, like Cashfree's popup.
type Options = {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill?: { contact?: string; email?: string };
  theme?: { color?: string };
  handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  modal?: { ondismiss?: () => void };
};
type Instance = { open(): void; on(event: "payment.failed", cb: (response: { error?: { description?: string } }) => void): void };
export type RazorpayCheckout = new (options: Options) => Instance;

declare global {
  interface Window { Razorpay?: RazorpayCheckout }
}

let loading: Promise<RazorpayCheckout> | null = null;

export function loadRazorpay(): Promise<RazorpayCheckout> {
  loading ??= new Promise<RazorpayCheckout>((resolve, reject) => {
    const fail = () => {
      loading = null; // let the next click try again
      reject(new Error("The payment window could not load. Check your connection and try again."));
    };
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => (window.Razorpay ? resolve(window.Razorpay) : fail());
    s.onerror = fail;
    document.head.appendChild(s);
  });
  return loading;
}
