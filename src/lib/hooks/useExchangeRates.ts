import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ExchangeRatesResponse {
  success: boolean;
  base: string;
  date: string;
  rates: Record<string, number>;
  error?: string;
}

export function useExchangeRates() {
  return useQuery({
    queryKey: ['exchange-rates'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<ExchangeRatesResponse>(
        'fetch-exchange-rates'
      );
      
      if (error) {
        console.error('Error fetching exchange rates:', error);
        // Return fallback rates
        return {
          success: false,
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
          }
        };
      }
      
      return data;
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
    gcTime: 1000 * 60 * 60 * 24, // Keep in cache for 24 hours
    refetchOnWindowFocus: false,
  });
}

// Helper to get exchange rate for converting a currency TO USD
// The API returns rates as "1 USD = X units of currency"
// To convert currency to USD, we need to DIVIDE by the rate (or multiply by 1/rate)
// This function returns the multiplier to convert FROM the currency TO USD
export function getExchangeRate(rates: Record<string, number> | undefined, currency: string): number {
  if (!rates) return 1;
  if (currency === 'USD') return 1;
  
  const rate = rates[currency];
  if (!rate || rate === 0) return 1;
  
  // Invert the rate: if 1 USD = 9.18 SEK, then 1 SEK = 1/9.18 USD = 0.109 USD
  return 1 / rate;
}
