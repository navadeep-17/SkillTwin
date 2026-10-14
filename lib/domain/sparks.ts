// Spark prices are illustrative product policy, not estimates of underlying model cost.
// Core learning, saved roadmaps, profile state, routine assessment and basic chat stay free.
export const WELCOME_SPARKS = 100;
export const REFERRAL_SPARKS = 50;
export const MONTHLY_REWARDED_REFERRAL_LIMIT = 5;
export const FREE_ENHANCED_REPLIES = 3;
export const FREE_RESUME_ANALYSES = 1;
export const WEEKLY_REFILL_SPARKS = 20;
export const WEEKLY_REFILL_THRESHOLD = 30;
export const SPARKS_PRICES = {
  CUSTOM_ROLE: 25,
  PROJECT_DEFENSE: 15,
  ENHANCED_CHAT: 5,
  RESUME_REANALYSIS: 15
} as const;
export type SparksAction = keyof typeof SPARKS_PRICES;
export type MeteredSparksAction = "ENHANCED_CHAT" | "RESUME_REANALYSIS";
export function isReferralCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-F0-9]{12}$/.test(value);
}
export function sparksPrice(action: SparksAction): number {
  return SPARKS_PRICES[action];
}
export function enhancedReadIsMetered(enhanced: boolean, isMutating: boolean) {
  return enhanced && !isMutating;
}
