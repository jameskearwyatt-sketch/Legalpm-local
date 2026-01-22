const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnrichmentRequest {
  contactId: string;
  fullName: string;
  email: string;
  linkedinUrl?: string | null;
  company?: string | null;
}

interface EnrichmentResult {
  gender?: 'male' | 'female' | 'unknown';
  company?: string;
  country?: string;
  city?: string;
  job_title?: string;
  sectors?: string[];
  linkedin_url?: string;
  email?: string;
  email_status?: string;
  sic_codes?: string[];
  naics_codes?: string[];
  company_keywords?: string[];
  confidence: {
    gender?: number;
    location?: number;
    sector?: number;
  };
  sources: string[];
}

interface ApolloPersonResponse {
  person?: {
    first_name?: string;
    last_name?: string;
    name?: string;
    title?: string;
    city?: string;
    state?: string;
    country?: string;
    linkedin_url?: string;
    email?: string;
    email_status?: string;
    organization?: {
      name?: string;
      industry?: string;
      primary_industry?: string;
      keywords?: string[];
      sic_codes?: string[];
      naics_codes?: string[];
    };
  };
}

// Common male/female name patterns for gender inference (fallback)
const maleNames = new Set([
  'james', 'john', 'robert', 'michael', 'david', 'william', 'richard', 'joseph', 'thomas', 'charles',
  'christopher', 'daniel', 'matthew', 'anthony', 'mark', 'donald', 'steven', 'paul', 'andrew', 'joshua',
  'kenneth', 'kevin', 'brian', 'george', 'timothy', 'ronald', 'edward', 'jason', 'jeffrey', 'ryan',
  'jacob', 'gary', 'nicholas', 'eric', 'jonathan', 'stephen', 'larry', 'justin', 'scott', 'brandon',
  'benjamin', 'samuel', 'raymond', 'gregory', 'frank', 'alexander', 'patrick', 'jack', 'dennis', 'jerry',
  'peter', 'henry', 'carl', 'arthur', 'roger', 'joe', 'juan', 'albert', 'willie', 'bruce',
  'adam', 'harry', 'ralph', 'eugene', 'randy', 'philip', 'howard', 'vincent', 'russell', 'louis',
  'martin', 'oliver', 'leo', 'max', 'lucas', 'ethan', 'noah', 'liam', 'mason', 'logan',
  'tom', 'mike', 'chris', 'dan', 'matt', 'nick', 'alex', 'ben', 'sam', 'steve',
  'mohammed', 'muhammad', 'ahmed', 'ali', 'omar', 'hassan', 'hussein', 'khalid', 'tariq', 'amir',
  'raj', 'amit', 'vijay', 'rahul', 'sanjay', 'suresh', 'ravi', 'kumar', 'arun', 'vikram',
  'wei', 'chen', 'ming', 'jun', 'hong', 'lei', 'yong', 'feng', 'jian', 'xin',
  'hiroshi', 'takeshi', 'kenji', 'yuki', 'ken', 'taro', 'akira', 'naoki', 'koji', 'daisuke',
  'stefan', 'hans', 'klaus', 'wolfgang', 'andreas', 'thomas', 'markus', 'peter', 'jurgen', 'dieter',
  'jean', 'pierre', 'michel', 'francois', 'jacques', 'philippe', 'marc', 'laurent', 'nicolas', 'antoine',
  'carlos', 'jose', 'luis', 'miguel', 'antonio', 'francisco', 'pedro', 'manuel', 'rafael', 'jorge'
]);

const femaleNames = new Set([
  'mary', 'patricia', 'jennifer', 'linda', 'barbara', 'elizabeth', 'susan', 'jessica', 'sarah', 'karen',
  'lisa', 'nancy', 'betty', 'margaret', 'sandra', 'ashley', 'kimberly', 'emily', 'donna', 'michelle',
  'dorothy', 'carol', 'amanda', 'melissa', 'deborah', 'stephanie', 'rebecca', 'sharon', 'laura', 'cynthia',
  'kathleen', 'amy', 'angela', 'shirley', 'anna', 'brenda', 'pamela', 'emma', 'nicole', 'helen',
  'samantha', 'katherine', 'christine', 'debra', 'rachel', 'carolyn', 'janet', 'catherine', 'maria', 'heather',
  'diane', 'ruth', 'julie', 'olivia', 'joyce', 'virginia', 'victoria', 'kelly', 'lauren', 'christina',
  'joan', 'evelyn', 'judith', 'megan', 'andrea', 'cheryl', 'hannah', 'jacqueline', 'martha', 'gloria',
  'teresa', 'ann', 'sara', 'madison', 'frances', 'kathryn', 'janice', 'jean', 'abigail', 'alice',
  'sophia', 'grace', 'chloe', 'isabella', 'charlotte', 'mia', 'amelia', 'harper', 'evelyn', 'aria',
  'fatima', 'aisha', 'mariam', 'zahra', 'sara', 'layla', 'noor', 'hana', 'yasmin', 'amira',
  'priya', 'anita', 'sunita', 'rekha', 'meena', 'deepa', 'kavita', 'neha', 'pooja', 'divya',
  'yan', 'li', 'fang', 'xia', 'ying', 'mei', 'juan', 'lan', 'ping', 'min',
  'yuki', 'sakura', 'akiko', 'yoko', 'keiko', 'hiroko', 'michiko', 'naomi', 'mari', 'emi',
  'anna', 'maria', 'katrin', 'claudia', 'sabine', 'petra', 'stefanie', 'monika', 'andrea', 'nicole',
  'marie', 'sophie', 'camille', 'claire', 'julie', 'nathalie', 'sylvie', 'isabelle', 'anne', 'valerie',
  'carmen', 'lucia', 'rosa', 'elena', 'laura', 'isabel', 'ana', 'teresa', 'cristina', 'paula'
]);

function inferGenderFromName(fullName: string): { gender: 'male' | 'female' | 'unknown'; confidence: number } {
  const firstName = fullName.trim().split(/\s+/)[0].toLowerCase();
  
  if (maleNames.has(firstName)) {
    return { gender: 'male', confidence: 0.85 };
  }
  if (femaleNames.has(firstName)) {
    return { gender: 'female', confidence: 0.85 };
  }
  
  // Check name endings as heuristics
  if (firstName.endsWith('a') || firstName.endsWith('ie') || firstName.endsWith('ine') || firstName.endsWith('elle')) {
    return { gender: 'female', confidence: 0.6 };
  }
  if (firstName.endsWith('o') || firstName.endsWith('us') || firstName.endsWith('er')) {
    return { gender: 'male', confidence: 0.6 };
  }
  
  return { gender: 'unknown', confidence: 0 };
}

async function enrichWithApollo(email: string, fullName: string, apiKey: string): Promise<ApolloPersonResponse | null> {
  try {
    console.log('Enriching with Apollo:', { email, fullName });
    
    // Apollo People Enrichment API
    const response = await fetch('https://api.apollo.io/v1/people/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        email: email,
        name: fullName,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Apollo API error:', response.status, errorText);
      return null;
    }
    
    const data = await response.json();
    console.log('Apollo response:', JSON.stringify(data, null, 2));
    
    return data;
  } catch (error) {
    console.error('Error calling Apollo API:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contactId, fullName, email, linkedinUrl, company }: EnrichmentRequest = await req.json();
    
    console.log('Enriching contact:', { contactId, fullName, email, linkedinUrl, company });
    
    const apolloApiKey = Deno.env.get('APOLLO_API_KEY');
    if (!apolloApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Apollo API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const result: EnrichmentResult = {
      confidence: {},
      sources: [],
    };
    
    // 1. Enrich with Apollo
    const apolloData = await enrichWithApollo(email, fullName, apolloApiKey);
    
    if (apolloData?.person) {
      const person = apolloData.person;
      result.sources.push('apollo');
      
      // Job title
      if (person.title) {
        result.job_title = person.title;
      }
      
      // Location
      if (person.city || person.country) {
        result.city = person.city || undefined;
        result.country = person.country || undefined;
        result.confidence.location = 0.9;
      }
      
      // LinkedIn URL
      if (person.linkedin_url) {
        result.linkedin_url = person.linkedin_url;
      }
      
      // Company
      if (person.organization?.name) {
        result.company = person.organization.name;
      }
      
      // Sectors/Industry
      if (person.organization?.industry || person.organization?.primary_industry) {
        const industry = person.organization.primary_industry || person.organization.industry;
        if (industry) {
          result.sectors = [industry];
          result.confidence.sector = 0.85;
        }
      }
      
      // Email - update if Apollo found an email (any status, not just verified)
      if (person.email) {
        result.email = person.email;
      }
      
      // Email status
      if (person.email_status) {
        result.email_status = person.email_status;
      }
      
      // SIC codes
      if (person.organization?.sic_codes && person.organization.sic_codes.length > 0) {
        result.sic_codes = person.organization.sic_codes;
      }
      
      // NAICS codes
      if (person.organization?.naics_codes && person.organization.naics_codes.length > 0) {
        result.naics_codes = person.organization.naics_codes;
      }
      
      // Company keywords
      if (person.organization?.keywords && person.organization.keywords.length > 0) {
        result.company_keywords = person.organization.keywords;
      }
    }
    
    // 2. Fallback: Infer gender from name (Apollo doesn't provide gender)
    const genderResult = inferGenderFromName(fullName);
    result.gender = genderResult.gender;
    result.confidence.gender = genderResult.confidence;
    if (!result.sources.includes('name_analysis')) {
      result.sources.push('name_analysis');
    }
    
    // 3. Fallback: Use provided company if Apollo didn't find one
    if (!result.company && company) {
      result.company = company;
    }
    
    // 4. Fallback: Use provided LinkedIn URL if Apollo didn't find one
    if (!result.linkedin_url && linkedinUrl) {
      result.linkedin_url = linkedinUrl;
    }
    
    console.log('Enrichment result:', result);
    
    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Enrichment error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Enrichment failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
