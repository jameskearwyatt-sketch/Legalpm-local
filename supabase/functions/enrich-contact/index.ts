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
      city?: string;
      state?: string;
      country?: string;
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

async function searchApolloByNameAndCompany(fullName: string, company: string, apiKey: string): Promise<ApolloPersonResponse | null> {
  try {
    console.log('Searching Apollo by name + company:', { fullName, company });
    
    // Apollo People Search API - finds people by name and organization
    const response = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        q_person_name: fullName,
        q_organization_name: company,
        per_page: 1,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Apollo Search API error:', response.status, errorText);
      return null;
    }
    
    const data = await response.json();
    console.log('Apollo Search response:', JSON.stringify(data, null, 2));
    
    // Return first matching person
    if (data.people && data.people.length > 0) {
      return { person: data.people[0] };
    }
    
    return null;
  } catch (error) {
    console.error('Error calling Apollo Search API:', error);
    return null;
  }
}

async function matchApolloByLinkedIn(linkedinUrl: string, apiKey: string): Promise<ApolloPersonResponse | null> {
  try {
    console.log('Matching Apollo by LinkedIn URL:', { linkedinUrl });
    
    // Apollo People Match API - matches by LinkedIn URL (most accurate, always current)
    const response = await fetch('https://api.apollo.io/v1/people/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        linkedin_url: linkedinUrl,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Apollo LinkedIn Match API error:', response.status, errorText);
      return null;
    }
    
    const data = await response.json();
    console.log('Apollo LinkedIn Match response:', JSON.stringify(data, null, 2));
    
    return data;
  } catch (error) {
    console.error('Error calling Apollo LinkedIn Match API:', error);
    return null;
  }
}

async function matchApolloByEmail(email: string, fullName: string, apiKey: string): Promise<ApolloPersonResponse | null> {
  try {
    console.log('Matching Apollo by email:', { email, fullName });
    
    // Apollo People Match API - matches by email
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
      console.error('Apollo Match API error:', response.status, errorText);
      return null;
    }
    
    const data = await response.json();
    console.log('Apollo Match response:', JSON.stringify(data, null, 2));
    
    return data;
  } catch (error) {
    console.error('Error calling Apollo Match API:', error);
    return null;
  }
}

async function enrichWithApollo(
  email: string, 
  fullName: string, 
  company: string | null, 
  linkedinUrl: string | null,
  apiKey: string
): Promise<ApolloPersonResponse | null> {
  // Strategy for maximum accuracy:
  // 1. LinkedIn URL match - gets current company/job info (most reliable)
  // 2. If LinkedIn found a company, search name + NEW company to get current email
  // 3. Fall back to name + provided company, then email match
  
  let baseResult: ApolloPersonResponse | null = null;
  let currentCompany: string | null = company;
  
  // 1. Try LinkedIn URL first (most reliable for current job/company data)
  if (linkedinUrl) {
    const linkedInResult = await matchApolloByLinkedIn(linkedinUrl, apiKey);
    if (linkedInResult?.person) {
      console.log('Found person via LinkedIn URL match');
      baseResult = linkedInResult;
      
      // Extract the CURRENT company from LinkedIn data
      if (linkedInResult.person.organization?.name) {
        currentCompany = linkedInResult.person.organization.name;
        console.log('LinkedIn found current company:', currentCompany);
      }
      
      // If LinkedIn result doesn't have email, try to find it via name + current company search
      if (!linkedInResult.person.email && currentCompany) {
        console.log('LinkedIn has no email, searching by name + current company for email...');
        const emailSearchResult = await searchApolloByNameAndCompany(fullName, currentCompany, apiKey);
        
        if (emailSearchResult?.person?.email) {
          console.log('Found email via name + company search:', emailSearchResult.person.email);
          // Merge: keep LinkedIn data but add email from search
          baseResult.person!.email = emailSearchResult.person.email;
          baseResult.person!.email_status = emailSearchResult.person.email_status;
        }
      }
      
      return baseResult;
    }
  }
  
  // 2. Try name + company search (use current company if we found one)
  if (currentCompany) {
    const searchResult = await searchApolloByNameAndCompany(fullName, currentCompany, apiKey);
    if (searchResult?.person) {
      console.log('Found person via name + company search');
      return searchResult;
    }
  }
  
  // 3. Fall back to email match
  const matchResult = await matchApolloByEmail(email, fullName, apiKey);
  if (matchResult?.person) {
    console.log('Found person via email match');
    return matchResult;
  }
  
  return null;
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
    
    // 1. Enrich with Apollo - prioritize LinkedIn URL, then name + company, then email
    const apolloData = await enrichWithApollo(email, fullName, company || null, linkedinUrl || null, apolloApiKey);
    
    if (apolloData?.person) {
      const person = apolloData.person;
      result.sources.push('apollo');
      
      // Job title
      if (person.title) {
        result.job_title = person.title;
      }
      
      // Location - prefer organization location (more current) over person location (often stale)
      const orgCity = person.organization?.city;
      const orgCountry = person.organization?.country;
      const personCity = person.city;
      const personCountry = person.country;
      
      // Use organization location if available, fall back to person location
      if (orgCity || orgCountry) {
        result.city = orgCity || undefined;
        result.country = orgCountry || undefined;
        result.confidence.location = 0.95; // Higher confidence for org location
      } else if (personCity || personCountry) {
        result.city = personCity || undefined;
        result.country = personCountry || undefined;
        result.confidence.location = 0.7; // Lower confidence for person location (can be stale)
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
