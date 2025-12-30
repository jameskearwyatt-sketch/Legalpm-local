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
  return `${symbol}${value.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
