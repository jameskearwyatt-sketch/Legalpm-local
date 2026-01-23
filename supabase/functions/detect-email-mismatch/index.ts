import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Known email domain patterns that don't match company names
const PERSONAL_EMAIL_DOMAINS = [
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'hotmail.com', 
  'outlook.com', 'live.com', 'msn.com', 'aol.com', 'icloud.com', 'me.com',
  'mail.com', 'protonmail.com', 'proton.me', 'zoho.com', 'yandex.com',
  'gmx.com', 'gmx.net', 'fastmail.com', 'tutanota.com'
];

// Common company name variations to normalize
const COMPANY_NORMALIZATIONS: Record<string, string[]> = {
  'jpmorgan': ['jp morgan', 'j.p. morgan', 'jpmorgan chase', 'jpmorganChase'],
  'goldmansachs': ['goldman sachs', 'goldman'],
  'morganstanley': ['morgan stanley'],
  'bankofamerica': ['bank of america', 'bofa', 'boa'],
  'wellsfargo': ['wells fargo'],
  'citigroup': ['citi', 'citibank'],
  'deutschebank': ['deutsche bank', 'db'],
  'barclays': ['barclays bank', 'barclays plc'],
  'hsbc': ['hsbc bank', 'hsbc holdings'],
  'ubs': ['ubs group', 'ubs ag'],
  'creditsuisse': ['credit suisse', 'cs'],
  'bnpparibas': ['bnp paribas', 'bnp'],
  'societegenerale': ['societe generale', 'socgen'],
  'standardchartered': ['standard chartered'],
  'northerntrust': ['northern trust'],
  'statestreet': ['state street'],
  'blackrock': ['black rock'],
  'fidelity': ['fidelity investments'],
  'vanguard': ['vanguard group'],
  'pwc': ['pricewaterhousecoopers', 'pricewaterhouse coopers'],
  'ey': ['ernst & young', 'ernst and young', 'ernstandyoung'],
  'deloitte': ['deloitte touche', 'deloitte & touche'],
  'kpmg': ['klynveld peat marwick goerdeler'],
  'mckinsey': ['mckinsey & company', 'mckinsey and company'],
  'bcg': ['boston consulting group', 'boston consulting'],
  'bain': ['bain & company', 'bain and company'],
};

function normalizeForComparison(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric
    .trim();
}

function extractDomainFromEmail(email: string): string {
  const match = email.match(/@([^@]+)$/);
  if (!match) return '';
  const domain = match[1].toLowerCase();
  // Get the main domain part (before .com, .co.uk, etc.)
  const parts = domain.split('.');
  if (parts.length >= 2) {
    // Handle cases like .co.uk, .com.au
    if (parts[parts.length - 2] === 'co' || parts[parts.length - 2] === 'com') {
      return parts.slice(0, -2).join('');
    }
    return parts.slice(0, -1).join('');
  }
  return parts[0];
}

function checkEmailCompanyMatch(email: string, company: string | null): { mismatch: boolean; reason: string } {
  if (!email || !company) {
    return { mismatch: false, reason: 'Missing email or company' };
  }

  const emailDomain = extractDomainFromEmail(email);
  const normalizedCompany = normalizeForComparison(company);
  const normalizedDomain = normalizeForComparison(emailDomain);

  // Skip personal email domains - these are expected mismatches but not flagged
  const fullDomain = email.split('@')[1]?.toLowerCase();
  if (PERSONAL_EMAIL_DOMAINS.includes(fullDomain)) {
    return { mismatch: false, reason: 'Personal email domain - not flagged' };
  }

  // Direct match
  if (normalizedDomain === normalizedCompany) {
    return { mismatch: false, reason: 'Direct domain-company match' };
  }

  // Check if domain is contained in company name or vice versa
  if (normalizedCompany.includes(normalizedDomain) || normalizedDomain.includes(normalizedCompany)) {
    return { mismatch: false, reason: 'Partial match - domain in company or vice versa' };
  }

  // Check known normalizations
  for (const [canonical, variations] of Object.entries(COMPANY_NORMALIZATIONS)) {
    const allForms = [canonical, ...variations.map(v => normalizeForComparison(v))];
    const domainMatches = allForms.some(form => 
      normalizedDomain.includes(form) || form.includes(normalizedDomain)
    );
    const companyMatches = allForms.some(form => 
      normalizedCompany.includes(form) || form.includes(normalizedCompany)
    );
    
    if (domainMatches && companyMatches) {
      return { mismatch: false, reason: `Known variation match: ${canonical}` };
    }
  }

  // Check if domain could be an acronym of company name
  const companyWords = company.toLowerCase().split(/\s+/).filter(w => w.length > 1 && !['the', 'of', 'and', 'for', 'in', 'a', 'an', 'inc', 'ltd', 'llc', 'plc', 'corp', 'co', 'limited', 'corporation'].includes(w));
  if (companyWords.length >= 2) {
    // Create potential acronym from first letters
    const acronym = companyWords.map(w => w[0]).join('');
    if (normalizedDomain.includes(acronym) || acronym.includes(normalizedDomain)) {
      return { mismatch: false, reason: `Domain matches company acronym: ${acronym}` };
    }
    // Also check first 2-3 letters of first few words combined
    const shortAcronym = companyWords.slice(0, 3).map(w => w.slice(0, 2)).join('');
    if (shortAcronym.length >= 4 && normalizedDomain.includes(shortAcronym)) {
      return { mismatch: false, reason: `Domain matches company short form: ${shortAcronym}` };
    }
  }

  // Check if first significant word matches
  const firstCompanyWord = companyWords[0] ? normalizeForComparison(companyWords[0]) : '';
  if (firstCompanyWord && firstCompanyWord.length > 2 && normalizedDomain.includes(firstCompanyWord)) {
    return { mismatch: false, reason: 'First word of company in domain' };
  }
  
  // Check if any significant word from company is in domain
  for (const word of companyWords) {
    const normWord = normalizeForComparison(word);
    if (normWord.length >= 4 && normalizedDomain.includes(normWord)) {
      return { mismatch: false, reason: `Company word "${word}" found in domain` };
    }
  }
  
  // Check if domain contains company initials pattern (for things like "Development Bank of Japan" -> "dbj")
  if (companyWords.length >= 2) {
    const initials = companyWords.map(w => w[0]).join('');
    if (initials.length >= 2 && normalizedDomain === initials) {
      return { mismatch: false, reason: `Domain matches company initials: ${initials}` };
    }
  }

  // If we get here, it's likely a mismatch
  return { 
    mismatch: true, 
    reason: `Domain "${emailDomain}" does not match company "${company}"` 
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { contactIds, runAll } = await req.json();

    console.log(`[detect-email-mismatch] Starting. runAll=${runAll}, contactIds count=${contactIds?.length || 0}`);

    let query = supabase
      .from('distribution_contacts')
      .select('id, email, company, email_company_mismatch, email_mismatch_dismissed');

    if (runAll) {
      // Get all contacts that haven't been dismissed
      query = query.eq('email_mismatch_dismissed', false);
    } else if (contactIds && contactIds.length > 0) {
      query = query.in('id', contactIds);
    } else {
      return new Response(
        JSON.stringify({ error: 'Must provide contactIds or runAll=true' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: contacts, error: fetchError } = await query;

    if (fetchError) {
      console.error('[detect-email-mismatch] Fetch error:', fetchError);
      throw fetchError;
    }

    console.log(`[detect-email-mismatch] Checking ${contacts?.length || 0} contacts`);

    const results: { id: string; mismatch: boolean; reason: string }[] = [];
    const updates: { id: string; email_company_mismatch: boolean }[] = [];

    for (const contact of contacts || []) {
      const { mismatch, reason } = checkEmailCompanyMatch(contact.email, contact.company);
      results.push({ id: contact.id, mismatch, reason });

      // Only update if the mismatch status changed
      if (mismatch !== contact.email_company_mismatch) {
        updates.push({ id: contact.id, email_company_mismatch: mismatch });
      }
    }

    // Batch update contacts with changed mismatch status
    let updatedCount = 0;
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('distribution_contacts')
        .update({ email_company_mismatch: update.email_company_mismatch })
        .eq('id', update.id);

      if (updateError) {
        console.error(`[detect-email-mismatch] Update error for ${update.id}:`, updateError);
      } else {
        updatedCount++;
      }
    }

    const mismatchCount = results.filter(r => r.mismatch).length;
    console.log(`[detect-email-mismatch] Complete. Checked ${results.length}, found ${mismatchCount} mismatches, updated ${updatedCount}`);

    return new Response(
      JSON.stringify({
        checked: results.length,
        mismatches: mismatchCount,
        updated: updatedCount,
        details: results.filter(r => r.mismatch)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[detect-email-mismatch] Error:', errMsg);
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
