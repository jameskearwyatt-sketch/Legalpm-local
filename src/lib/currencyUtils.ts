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
 * Exchange rate interpretation depends on the source currency:
 * - For GBP: exchange_rate is the direct GBP→USD rate (e.g., 1.35 means 1 GBP = 1.35 USD)
 * - For other currencies: exchange_rate is the rate TO GBP (e.g., 0.109 for SEK means 1 SEK = 0.109 GBP)
 * 
 * @param amount - The amount in the source currency
 * @param feeCurrency - The source currency (e.g., 'GBP', 'EUR', 'USD')
 * @param exchangeRate - The stored exchange rate (interpretation depends on currency)
 * @param gbpToUsdRate - The live GBP to USD rate (e.g., 1.35 means 1 GBP = 1.35 USD)
 * @returns The amount converted to USD
 */
export function convertToUsd(
  amount: number, 
  feeCurrency: string, 
  exchangeRate: number,
  gbpToUsdRate?: number
): number {
  // If already USD, no conversion needed
  if (feeCurrency === 'USD') {
    return amount;
  }
  
  // Default GBP to USD rate if not provided
  const liveGbpUsdRate = gbpToUsdRate || 1.27;
  
  // For GBP: the stored exchange_rate IS the GBP→USD rate
  if (feeCurrency === 'GBP') {
    // Use the stored rate if it looks like a valid GBP→USD rate (typically 1.2-1.5)
    // Otherwise fall back to the live rate
    const rateToUse = (exchangeRate > 1 && exchangeRate < 2) ? exchangeRate : liveGbpUsdRate;
    return amount * rateToUse;
  }
  
  // For all other currencies: exchange_rate is the rate TO GBP
  // First convert to GBP, then convert GBP to USD
  const amountInGbp = amount * exchangeRate;
  return amountInGbp * liveGbpUsdRate;
}
