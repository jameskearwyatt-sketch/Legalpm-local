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
    // Apollo often stores the CURRENT email in a nested contact object
    contact?: {
      email?: string;
      email_status?: string;
      organization_name?: string;
      city?: string;
      country?: string;
    };
    // Also check contact_emails array for the most current email
    contact_emails?: Array<{
      email?: string;
      email_status?: string;
      position?: number;
    }>;
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
  // COMPLETE ENRICHMENT STRATEGY:
  // 1. Try LinkedIn URL match first - this gives us the CURRENT company (most reliable for job changes)
  // 2. ALWAYS do a secondary search with name + current company to get email + location from Apollo's database
  // 3. Merge the results: LinkedIn for job/company, Apollo search for email/location
  // 4. Fallback: name + provided company, then email match
  
  let currentCompany: string | null = company;
  let linkedInData: ApolloPersonResponse | null = null;
  let apolloSearchData: ApolloPersonResponse | null = null;
  
  // STEP 1: Try LinkedIn URL first (most reliable for finding CURRENT company)
  if (linkedinUrl) {
    console.log('STEP 1: Matching by LinkedIn URL to find current company...');
    linkedInData = await matchApolloByLinkedIn(linkedinUrl, apiKey);
    
    if (linkedInData?.person) {
      console.log('LinkedIn match found person');
      
      // Extract the CURRENT company from LinkedIn data
      if (linkedInData.person.organization?.name) {
        const linkedInCompany = linkedInData.person.organization.name;
        console.log('LinkedIn found current company:', linkedInCompany);
        
        // Update to use the NEW company from LinkedIn
        if (linkedInCompany !== company) {
          console.log('Company has CHANGED from:', company, 'to:', linkedInCompany);
        }
        currentCompany = linkedInCompany;
      }
    }
  }
  
  // STEP 2: ALWAYS search by name + current company to get email and location from Apollo's database
  // This is critical because LinkedIn match often doesn't have email, but Apollo's search does
  if (currentCompany) {
    console.log('STEP 2: Searching Apollo database by name + current company for email/location...');
    apolloSearchData = await searchApolloByNameAndCompany(fullName, currentCompany, apiKey);
    
    if (apolloSearchData?.person) {
      console.log('Apollo search found person with email:', apolloSearchData.person.email || 'NO EMAIL');
      console.log('Apollo search found location:', apolloSearchData.person.organization?.city, apolloSearchData.person.organization?.country);
    } else {
      console.log('Apollo search by name + company returned no results');
    }
  }
  
  // STEP 3: Merge results - prioritize different sources for different data
  // LinkedIn: best for current job title and company (job changes)
  // Apollo search: best for email and location (their database has this)
  
  if (linkedInData?.person || apolloSearchData?.person) {
    const mergedResult: ApolloPersonResponse = { person: {} };
    const linkedIn = linkedInData?.person;
    const apolloSearch = apolloSearchData?.person;
    
    // Job title: prefer LinkedIn (most current for job changes)
    mergedResult.person!.title = linkedIn?.title || apolloSearch?.title;
    
    // Company/Organization: prefer LinkedIn (most current)
    mergedResult.person!.organization = linkedIn?.organization || apolloSearch?.organization;
    
    // LinkedIn URL: prefer LinkedIn source
    mergedResult.person!.linkedin_url = linkedIn?.linkedin_url || apolloSearch?.linkedin_url;
    
    // EMAIL: prefer Apollo search result (their database has emails, LinkedIn match often doesn't)
    if (apolloSearch?.email) {
      console.log('Using email from Apollo search:', apolloSearch.email);
      mergedResult.person!.email = apolloSearch.email;
      mergedResult.person!.email_status = apolloSearch.email_status;
    } else if (linkedIn?.email) {
      console.log('Falling back to email from LinkedIn match:', linkedIn.email);
      mergedResult.person!.email = linkedIn.email;
      mergedResult.person!.email_status = linkedIn.email_status;
    }
    
    // LOCATION: prefer Apollo search organization location (most accurate for current role)
    if (apolloSearch?.organization?.city || apolloSearch?.organization?.country) {
      console.log('Using location from Apollo search org:', apolloSearch.organization?.city, apolloSearch.organization?.country);
      // Ensure we have the org data with location
      if (!mergedResult.person!.organization) {
        mergedResult.person!.organization = {};
      }
      mergedResult.person!.organization.city = apolloSearch.organization?.city || mergedResult.person!.organization.city;
      mergedResult.person!.organization.country = apolloSearch.organization?.country || mergedResult.person!.organization.country;
    }
    
    // Person-level location (fallback)
    mergedResult.person!.city = apolloSearch?.city || linkedIn?.city;
    mergedResult.person!.country = apolloSearch?.country || linkedIn?.country;
    
    // Industry data: prefer Apollo search (richer data)
    if (apolloSearch?.organization) {
      if (!mergedResult.person!.organization) {
        mergedResult.person!.organization = {};
      }
      mergedResult.person!.organization.industry = apolloSearch.organization.industry || mergedResult.person!.organization.industry;
      mergedResult.person!.organization.primary_industry = apolloSearch.organization.primary_industry || mergedResult.person!.organization.primary_industry;
      mergedResult.person!.organization.keywords = apolloSearch.organization.keywords || mergedResult.person!.organization.keywords;
      mergedResult.person!.organization.sic_codes = apolloSearch.organization.sic_codes || mergedResult.person!.organization.sic_codes;
      mergedResult.person!.organization.naics_codes = apolloSearch.organization.naics_codes || mergedResult.person!.organization.naics_codes;
    }
    
    console.log('MERGED RESULT - email:', mergedResult.person!.email, 'company:', mergedResult.person!.organization?.name);
    return mergedResult;
  }
  
  // STEP 4: Fallback - try name + original company if we haven't tried it
  if (company && company !== currentCompany) {
    console.log('STEP 4: Fallback - trying name + original company:', company);
    const fallbackResult = await searchApolloByNameAndCompany(fullName, company, apiKey);
    if (fallbackResult?.person) {
      console.log('Found person via fallback name + original company search');
      return fallbackResult;
    }
  }
  
  // STEP 5: Last resort - email match (may return stale data)
  console.log('STEP 5: Last resort - trying email match');
  const matchResult = await matchApolloByEmail(email, fullName, apiKey);
  if (matchResult?.person) {
    console.log('Found person via email match (may be stale)');
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
      
      // EMAIL EXTRACTION - Apollo stores emails in multiple places, prioritize the most current:
      // 1. contact.email (most current, updated when person changes jobs)
      // 2. contact_emails[0].email (array of emails, first is usually most current)
      // 3. person.email (can be stale/old job email)
      let bestEmail: string | undefined;
      let bestEmailStatus: string | undefined;
      
      // Priority 1: Check nested contact object (this is where Apollo puts the CURRENT email)
      if (person.contact?.email) {
        bestEmail = person.contact.email;
        bestEmailStatus = person.contact.email_status;
        console.log('Found email in contact object:', bestEmail);
      }
      
      // Priority 2: Check contact_emails array
      if (!bestEmail && person.contact_emails && person.contact_emails.length > 0) {
        const primaryContactEmail = person.contact_emails.find(e => e.position === 0) || person.contact_emails[0];
        if (primaryContactEmail?.email) {
          bestEmail = primaryContactEmail.email;
          bestEmailStatus = primaryContactEmail.email_status;
          console.log('Found email in contact_emails array:', bestEmail);
        }
      }
      
      // Priority 3: Fall back to person.email (may be stale)
      if (!bestEmail && person.email) {
        bestEmail = person.email;
        bestEmailStatus = person.email_status;
        console.log('Using person.email (may be stale):', bestEmail);
      }
      
      if (bestEmail) {
        result.email = bestEmail;
      }
      if (bestEmailStatus) {
        result.email_status = bestEmailStatus;
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
