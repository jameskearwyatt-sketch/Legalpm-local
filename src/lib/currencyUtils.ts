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
 * The exchange_rate stored on matters is the rate to convert that currency TO USD directly.
 * For example: if fee_currency is GBP and exchange_rate is 1.35, it means 1 GBP = 1.35 USD.
 * 
 * @param amount - The amount in the source currency
 * @param feeCurrency - The source currency (e.g., 'GBP', 'EUR', 'USD')
 * @param exchangeRateToUsd - The stored exchange rate that converts the source currency TO USD
 *                            (e.g., 1.35 for GBP means 1 GBP = 1.35 USD)
 * @param _gbpToUsdRate - Deprecated/unused, kept for API compatibility
 * @returns The amount converted to USD
 */
export function convertToUsd(
  amount: number, 
  feeCurrency: string, 
  exchangeRateToUsd: number,
  _gbpToUsdRate?: number
): number {
  // If already USD, no conversion needed
  if (feeCurrency === 'USD') {
    return amount;
  }
  
  // The stored exchange_rate is the direct conversion to USD
  // e.g., for GBP with rate 1.35: £1 = $1.35
  return amount * exchangeRateToUsd;
}
