import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Free exchange rate API - no API key required
const EXCHANGE_RATE_API = 'https://api.exchangerate-api.com/v4/latest/USD';

// Currencies used in the app
const APP_CURRENCIES = ['GBP', 'USD', 'EUR', 'MYR', 'CHF', 'AUD', 'CAD', 'SGD'];

interface ExchangeRateResponse {
  base: string;
  date: string;
  rates: Record<string, number>;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Fetching exchange rates from API...');
    
    // Fetch latest rates from free API
    const response = await fetch(EXCHANGE_RATE_API);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch exchange rates: ${response.status}`);
    }
    
    const data: ExchangeRateResponse = await response.json();
    console.log('Exchange rates fetched successfully:', data.date);
    
    // Filter to only the currencies we use
    const filteredRates: Record<string, number> = {};
    for (const currency of APP_CURRENCIES) {
      if (data.rates[currency]) {
        filteredRates[currency] = data.rates[currency];
      } else if (currency === 'Ringgit' || currency === 'MYR') {
        // Handle Ringgit (Malaysian Ringgit = MYR)
        filteredRates['Ringgit'] = data.rates['MYR'] || 1;
      }
    }
    
    // USD is always 1 (base)
    filteredRates['USD'] = 1;
    
    return new Response(
      JSON.stringify({
        success: true,
        base: 'USD',
        date: data.date,
        rates: filteredRates,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error('Error fetching exchange rates:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        // Fallback rates if API fails
        rates: {
          'USD': 1,
          'GBP': 0.79,
          'EUR': 0.92,
          'CHF': 0.88,
          'AUD': 1.53,
          'CAD': 1.36,
          'SGD': 1.34,
          'Ringgit': 4.47,
        }
      }),
      {
        status: 200, // Still return 200 with fallback
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);
