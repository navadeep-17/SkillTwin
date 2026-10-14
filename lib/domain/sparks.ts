// Versioned pilot policy. Keep first career setup, initial roadmap, assessments,
// routine study, progress, and evidence-triggered replanning free.
export const WELCOME_SPARKS = 100;
export const REFERRAL_SPARKS = 50;
export const MONTHLY_REWARDED_REFERRAL_LIMIT = 5;
export const SPARKS_PRICES = {
  CUSTOM_ROLE: 25,
  PROJECT_DEFENSE: 15
} as const;
export type SparksAction = keyof typeof SPARKS_PRICES;
export function isReferralCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-F0-9]{12}$/.test(value);
}
export function sparksPrice(action: SparksAction): number {
  return SPARKS_PRICES[action];
}
