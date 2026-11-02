// Business details shown on the policy pages. Razorpay checks these during activation, so fill every
// bracketed value with the real one before submitting the site for review.
export const BUSINESS = {
  product: "Recall",
  operator: "NovAtomica",
  email: "support@novatomica.studio",
  updated: "2 November 2026",
};

// Plan prices in INR per month. Keep in step with the Razorpay plans.
export const PRICES = { pro: 699, ultra: 1999 } as const;

// Daily limits per plan, mirroring the backend defaults in config.py. ponytail: copied by hand; if the
// backend limits change, update here (the Account page reads the live values from the API).
export const PLAN_LIMITS = [
  { name: "Uploads", free: "3", pro: "15", ultra: "50" },
  { name: "Questions", free: "15", pro: "150", ultra: "500" },
  { name: "Quizzes", free: "2", pro: "10", ultra: "30" },
  { name: "Agent runs", free: "None", pro: "15", ultra: "50" },
  { name: "Voice inputs", free: "10", pro: "100", ultra: "300" },
  { name: "Live voice tutor", free: "None", pro: "20 min", ultra: "60 min" },
  { name: "Web-search answers", free: "None", pro: "30", ultra: "100" },
] as const;

export const TRIAL_DAYS = 7;
