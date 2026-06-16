import { useQuery } from '@tanstack/react-query';

interface ExchangeRatesResponse {
  success: boolean;
  base: string;
  date: string;
  rates: Record<string, number>;
  error?: string;
}

// Local-only edition: there is no network access, so currency conversion uses a
// fixed set of default rates (expressed as "1 USD = X units of currency").
function getDefaultRates(): ExchangeRatesResponse {
  return {
    success: true,
    base: 'USD',
    date: new Date().toISOString().split('T')[0],
    rates: {
      'USD': 1,
      'GBP': 0.79,
      'EUR': 0.92,
      'CHF': 0.88,
      'AUD': 1.53,
      'CAD': 1.36,
      'SGD': 1.34,
      'Ringgit': 4.47,
      'SEK': 10.95,
    },
  };
}

export function useExchangeRates() {
  return useQuery({
    queryKey: ['exchange-rates'],
    queryFn: async () => getDefaultRates(),
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
    gcTime: 1000 * 60 * 60 * 24, // Keep in cache for 24 hours
    refetchOnWindowFocus: false,
  });
}

// Helper to get exchange rate for converting a currency TO GBP
// The API returns rates as "1 USD = X units of currency"
// To convert currency to GBP:
// - If source is GBP, return 1
// - Otherwise: (1/source_rate) / (1/gbp_rate) = gbp_rate / source_rate
// This gives us: 1 unit of source currency = X GBP
export function getExchangeRate(rates: Record<string, number> | undefined, currency: string): number {
  if (!rates) return 1;
  if (currency === 'GBP') return 1;
  
  const sourceRate = rates[currency];
  const gbpRate = rates['GBP'];
  
  if (!sourceRate || sourceRate === 0 || !gbpRate || gbpRate === 0) return 1;
  
  // Convert to GBP: if 1 USD = 0.79 GBP and 1 USD = 1.34 SGD,
  // then 1 SGD = 0.79/1.34 GBP ≈ 0.59 GBP
  return gbpRate / sourceRate;
}
