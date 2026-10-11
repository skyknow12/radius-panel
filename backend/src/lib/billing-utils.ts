/**
 * Core Billing and Recharge Utility Functions
 * Safe decimal arithmetic, date math with month-end boundary clamping,
 * FreeRADIUS radcheck formatting, and pricing calculations.
 */

/**
 * Calculates new expiration date based on current expiry and recharge duration.
 * If current expiry is in the future, extends from current expiry.
 * If current expiry is in the past or null, extends from the current timestamp (now).
 * Clamps month-end dates to avoid JavaScript Date setMonth overflow across varying month lengths.
 */
export function calculateNewExpiry(
  currentExpiry: Date | string | null | undefined,
  durationMonths: number,
  now: Date = new Date(),
): Date {
  let baseExpiry = now;
  if (currentExpiry) {
    const exp = typeof currentExpiry === 'string' ? new Date(currentExpiry) : currentExpiry;
    if (!isNaN(exp.getTime()) && exp > now) {
      baseExpiry = exp;
    }
  }
  if (!durationMonths || durationMonths <= 0) {
    return new Date(baseExpiry.getTime());
  }
  const newExpiry = new Date(baseExpiry.getTime());
  const expectedMonth = (newExpiry.getMonth() + durationMonths) % 12;
  newExpiry.setMonth(newExpiry.getMonth() + durationMonths);
  if (newExpiry.getMonth() !== expectedMonth) {
    newExpiry.setDate(0); // Clamps to last valid day of month
  }
  return newExpiry;
}

/**
 * Formats a Date object for FreeRADIUS radcheck 'Expiration' attribute.
 * Format: "DD Mon YYYY 23:59:59" (e.g. "31 Oct 2026 23:59:59")
 */
export function formatRadiusExpiration(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year} 23:59:59`;
}

/**
 * Calculates recharge pricing, discount deduction, and tax calculation
 * with rounded decimal precision to prevent float drift.
 */
export function calculateRechargePricing(
  basePrice: number,
  durationMonths: number,
  discountType: 'none' | 'fixed' | 'percentage' = 'none',
  discountValue = 0,
  taxRate = 0,
): {
  originalPrice: number;
  discountAmount: number;
  subtotal: number;
  taxAmount: number;
  finalAmount: number;
} {
  const originalPrice = Math.round(Number(basePrice) * durationMonths * 100) / 100;
  let discountAmount = 0;
  if (discountType === 'percentage' && discountValue > 0) {
    discountAmount = Math.round(((originalPrice * Math.min(discountValue, 100)) / 100) * 100) / 100;
  } else if (discountType === 'fixed' && discountValue > 0) {
    discountAmount = Math.round(Math.min(discountValue, originalPrice) * 100) / 100;
  }
  const subtotal = Math.round(Math.max(0, originalPrice - discountAmount) * 100) / 100;
  const taxAmount = taxRate > 0 ? Math.round(((subtotal * taxRate) / 100) * 100) / 100 : 0;
  const finalAmount = Math.round((subtotal + taxAmount) * 100) / 100;
  return { originalPrice, discountAmount, subtotal, taxAmount, finalAmount };
}
