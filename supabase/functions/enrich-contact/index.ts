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
  confidence: {
    gender?: number;
    location?: number;
    sector?: number;
  };
  sources: string[];
}

// Common male/female name patterns for gender inference
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

function extractCompanyFromEmail(email: string): string | null {
  const domain = email.split('@')[1];
  if (!domain) return null;
  
  // Skip common personal email domains
  const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'live.com', 'msn.com', 'protonmail.com', 'mail.com'];
  if (personalDomains.includes(domain.toLowerCase())) {
    return null;
  }
  
  // Extract company name from domain
  const parts = domain.split('.');
  if (parts.length >= 2) {
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  }
  return null;
}

async function scrapeLinkedIn(url: string, apiKey: string): Promise<{ location?: string; company?: string; title?: string } | null> {
  try {
    console.log('Scraping LinkedIn URL:', url);
    
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 2000,
      }),
    });
    
    if (!response.ok) {
      console.error('LinkedIn scrape failed:', response.status);
      return null;
    }
    
    const data = await response.json();
    const markdown = data.data?.markdown || data.markdown || '';
    
    // Extract info from LinkedIn profile markdown
    const result: { location?: string; company?: string; title?: string } = {};
    
    // Look for location patterns
    const locationPatterns = [
      /(?:located in|based in|living in|from)\s+([^,\n]+(?:,\s*[^,\n]+)?)/i,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
    ];
    
    for (const pattern of locationPatterns) {
      const match = markdown.match(pattern);
      if (match) {
        result.location = match[1].trim();
        break;
      }
    }
    
    // Look for company/title patterns
    const companyMatch = markdown.match(/(?:works at|working at|employed at|at)\s+([^\n,]+)/i);
    if (companyMatch) {
      result.company = companyMatch[1].trim();
    }
    
    const titleMatch = markdown.match(/(?:^|\n)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:at|@)/m);
    if (titleMatch) {
      result.title = titleMatch[1].trim();
    }
    
    return result;
  } catch (error) {
    console.error('Error scraping LinkedIn:', error);
    return null;
  }
}

async function scrapeCompanyWebsite(companyName: string, apiKey: string): Promise<{ sector?: string; location?: string } | null> {
  try {
    // First, search for the company website
    console.log('Searching for company:', companyName);
    
    const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `${companyName} company official website`,
        limit: 3,
        scrapeOptions: {
          formats: ['markdown'],
        },
      }),
    });
    
    if (!searchResponse.ok) {
      console.error('Company search failed:', searchResponse.status);
      return null;
    }
    
    const searchData = await searchResponse.json();
    const results = searchData.data || [];
    
    if (results.length === 0) {
      return null;
    }
    
    // Combine content from results for analysis
    const combinedContent = results
      .map((r: { markdown?: string; description?: string }) => r.markdown || r.description || '')
      .join('\n\n')
      .slice(0, 5000); // Limit content size
    
    // Use AI to analyze and infer sector
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      console.error('LOVABLE_API_KEY not found');
      return null;
    }
    
    const aiResponse = await fetch('https://api.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are analyzing company website content to determine the company's primary business sector/industry.
            
Respond with a JSON object containing:
- sector: A concise industry/sector classification (e.g., "Technology", "Healthcare", "Financial Services", "Legal Services", "Manufacturing", "Retail", "Energy", "Real Estate", "Media & Entertainment", "Telecommunications", "Transportation", "Education", "Hospitality", "Agriculture", "Consulting", "Non-profit")
- confidence: A number from 0 to 1 indicating how confident you are

Only respond with valid JSON, no other text.`
          },
          {
            role: 'user',
            content: `Analyze this company website content for "${companyName}" and determine their primary business sector:\n\n${combinedContent}`
          }
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });
    
    if (!aiResponse.ok) {
      console.error('AI analysis failed:', aiResponse.status);
      return null;
    }
    
    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || '';
    
    try {
      const parsed = JSON.parse(aiContent.replace(/```json\n?|\n?```/g, '').trim());
      return { sector: parsed.sector };
    } catch {
      // Try to extract sector from plain text
      const sectorMatch = aiContent.match(/sector[:\s]+["']?([^"'\n,]+)/i);
      if (sectorMatch) {
        return { sector: sectorMatch[1].trim() };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error analyzing company:', error);
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
    
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const result: EnrichmentResult = {
      confidence: {},
      sources: [],
    };
    
    // 1. Infer gender from name
    const genderResult = inferGenderFromName(fullName);
    result.gender = genderResult.gender;
    result.confidence.gender = genderResult.confidence;
    result.sources.push('name_analysis');
    
    // 2. Get company from email if not provided
    let companyName = company;
    if (!companyName) {
      companyName = extractCompanyFromEmail(email);
      if (companyName) {
        result.company = companyName;
        result.sources.push('email_domain');
      }
    }
    
    // 3. Scrape LinkedIn if available
    if (linkedinUrl) {
      const linkedinData = await scrapeLinkedIn(linkedinUrl, firecrawlApiKey);
      if (linkedinData) {
        if (linkedinData.location) {
          // Parse location into country/city
          const parts = linkedinData.location.split(',').map(p => p.trim());
          if (parts.length >= 2) {
            result.city = parts[0];
            result.country = parts[parts.length - 1];
          } else {
            result.country = parts[0];
          }
          result.confidence.location = 0.8;
          result.sources.push('linkedin');
        }
        if (linkedinData.company && !companyName) {
          companyName = linkedinData.company;
          result.company = companyName;
          result.sources.push('linkedin');
        }
        if (linkedinData.title) {
          result.job_title = linkedinData.title;
        }
      }
    }
    
    // 4. Analyze company website for sector
    if (companyName) {
      const companyData = await scrapeCompanyWebsite(companyName, firecrawlApiKey);
      if (companyData?.sector) {
        result.sectors = [companyData.sector];
        result.confidence.sector = 0.7;
        result.sources.push('company_website');
      }
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
