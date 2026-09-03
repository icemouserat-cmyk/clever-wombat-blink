/**
 * AuraSpace Markup Logic
 * Default markup is 18-20%. We'll use a standard 20% for this implementation
 * but keep it configurable or passed as a parameter.
 */

export const calculateMarkup = (baseCost: number, markupPercentage: number = 0.20): number => {
  const markupAmount = baseCost * markupPercentage;
  return Number((baseCost + markupAmount).toFixed(2));
};

export const calculateLineTotal = (unitPrice: number, quantity: number): number => {
  return Number((unitPrice * quantity).toFixed(2));
};
