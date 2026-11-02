// Business details shown on the policy pages. The payment provider checks these during activation, so fill every
// bracketed value with the real one before submitting the site for review.
export const BUSINESS = {
  product: "Recall",
  operator: "NovAtomica",
  email: "support@novatomica.studio",
  updated: "2 November 2026",
};

// Price of one 30-day pass in INR. Keep in step with PRO_PRICE_INR / ULTRA_PRICE_INR in the backend config.
export const PRICES = { pro: 699, ultra: 1999 } as const;

// Weekly limits per plan, mirroring the backend defaults in config.py. ponytail: copied by hand; if the
// backend limits change, update here (the Account page reads the live values from the API).
export const PLAN_LIMITS = [
  { name: "Uploads", free: "6", pro: "30", ultra: "80" },
  { name: "Total storage", free: "50 MB", pro: "1 GB", ultra: "5 GB" },
  { name: "Questions", free: "30", pro: "200", ultra: "600" },
  { name: "Quizzes", free: "4", pro: "10", ultra: "30" },
  { name: "Agent runs", free: "None", pro: "10", ultra: "40" },
  { name: "Voice inputs", free: "20", pro: "100", ultra: "300" },
  { name: "Live voice tutor", free: "None", pro: "20 min", ultra: "60 min" },
  { name: "Web-search answers", free: "None", pro: "20", ultra: "80" },
] as const;

export const TRIAL_DAYS = 7;
