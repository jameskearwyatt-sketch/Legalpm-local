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
 * @param amount - The amount in the source currency
 * @param feeCurrency - The source currency (e.g., 'GBP', 'EUR', 'USD')
 * @param exchangeRateToGbp - The stored exchange rate that converts the source currency TO GBP
 *                            (e.g., 0.79 for USD means 1 USD = 0.79 GBP)
 * @param gbpToUsdRate - The rate to convert GBP to USD (optional, default ~1.27 if not provided)
 *                       This is: 1 GBP = X USD, so typically > 1
 * @returns The amount converted to USD
 */
export function convertToUsd(
  amount: number, 
  feeCurrency: string, 
  exchangeRateToGbp: number,
  gbpToUsdRate?: number
): number {
  // If already USD, no conversion needed
  if (feeCurrency === 'USD') {
    return amount;
  }
  
  // Default GBP to USD rate if not provided (approximate)
  const gbpUsdRate = gbpToUsdRate || 1.27;
  
  // First convert to GBP using the stored exchange rate
  // exchangeRateToGbp means: 1 unit of feeCurrency = exchangeRateToGbp GBP
  const amountInGbp = amount * exchangeRateToGbp;
  
  // Then convert GBP to USD
  // gbpUsdRate means: 1 GBP = gbpUsdRate USD
  return amountInGbp * gbpUsdRate;
}
