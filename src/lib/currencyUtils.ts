// Shared currency symbol mapping used across the application
export const CURRENCY_SYMBOLS: Record<string, string> = {
  'GBP': '£',
  'USD': '$',
  'EUR': '€',
  'MYR': 'RM ',
  'Ringgit': 'RM ',
  'CHF': 'CHF ',
  'AUD': 'A$',
  'CAD': 'C$',
  'SGD': 'S$',
  'SEK': 'kr '
};

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] || currency + ' ';
}

export function formatCurrency(value: number, currency: string = 'GBP'): string {
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${new Intl.NumberFormat('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)}`;
}

/**
 * Convert an amount from its native currency to USD.
 * 
 * This function uses a simple direct conversion approach:
 * - The exchangeRate parameter should be the rate TO USD (e.g., 1.35 for GBP means 1 GBP = 1.35 USD)
 * - If the stored rate appears to be a TO-GBP rate, we use the live rates to convert properly
 * 
 * @param amount - The amount in the source currency
 * @param feeCurrency - The source currency (e.g., 'GBP', 'EUR', 'USD')
 * @param storedExchangeRate - The stored exchange rate (may be TO-GBP or TO-USD depending on when it was saved)
 * @param gbpToUsdRate - The live GBP to USD rate (e.g., 1.35 means 1 GBP = 1.35 USD)
 * @param liveRates - Optional live rates object from the exchange rate API (base USD)
 * @returns The amount converted to USD
 */
export function convertToUsd(
  amount: number, 
  feeCurrency: string, 
  storedExchangeRate: number,
  gbpToUsdRate?: number,
  liveRates?: Record<string, number>
): number {
  // If already USD, no conversion needed
  if (feeCurrency === 'USD') {
    return amount;
  }
  
  // Default GBP to USD rate if not provided (1 GBP = ~1.35 USD)
  const liveGbpUsdRate = gbpToUsdRate || 1.35;
  
  // For GBP: use the stored rate directly if it looks valid, otherwise use live rate
  if (feeCurrency === 'GBP') {
    const rateToUse = (storedExchangeRate > 1 && storedExchangeRate < 2) ? storedExchangeRate : liveGbpUsdRate;
    return amount * rateToUse;
  }
  
  // For other currencies, we need to calculate the direct rate to USD
  // If live rates are provided, use them for accurate conversion
  if (liveRates && liveRates[feeCurrency]) {
    // API rates are "1 USD = X units of currency"
    // So to convert currency to USD: amount / rate
    const currencyPerUsd = liveRates[feeCurrency];
    return amount / currencyPerUsd;
  }
  
  // Fallback: use the stored exchange rate
  // The stored rate SHOULD be "1 unit of currency = X USD"
  // But historically it might be "1 unit of currency = X GBP"
  // We detect this by checking if the rate makes sense as a direct USD rate
  
  // For EUR: 1 EUR ≈ 1.05-1.20 USD typically
  // For SEK: 1 SEK ≈ 0.09-0.12 USD typically
  // For MYR: 1 MYR ≈ 0.21-0.25 USD typically
  
  // If the stored rate looks like a TO-GBP rate (small number for SEK, or ~0.85 for EUR),
  // we convert via GBP. Otherwise use it directly.
  const isLikelyToGbpRate = (
    (feeCurrency === 'EUR' && storedExchangeRate < 1) ||
    (feeCurrency === 'SEK' && storedExchangeRate < 0.2) ||
    (feeCurrency === 'MYR' && storedExchangeRate < 0.3) ||
    (feeCurrency === 'Ringgit' && storedExchangeRate < 0.3)
  );
  
  if (isLikelyToGbpRate) {
    // Convert via GBP: amount * (currency→GBP) * (GBP→USD)
    return amount * storedExchangeRate * liveGbpUsdRate;
  }
  
  // The stored rate is likely already a direct TO-USD rate
  return amount * storedExchangeRate;
}
