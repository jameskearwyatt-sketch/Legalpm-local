import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractedContact {
  full_name: string;
  email: string;
  company: string | null;
  job_title: string | null;
  phone: string | null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pastedText } = await req.json();

    if (!pastedText || typeof pastedText !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'No text provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are an expert at extracting contact information from messy, unstructured text data. Your task is to identify and extract individual contacts from pasted text that may come from various sources like Outlook, email signatures, address books, or copied data.

IMPORTANT RULES:
1. Each person with a valid email address should be extracted as a separate contact
2. Names may appear in various formats - ALWAYS output names in "Surname, FirstName" format:
   - "Surname, FirstName" (Outlook format) -> keep as "Surname, FirstName"
   - "FirstName Surname" -> convert to "Surname, FirstName"
   - "Mr./Ms./Dr. FirstName Surname" -> convert to "Surname, FirstName" (drop title)
   - Just email addresses with the name in the email prefix -> extract and format as "Surname, FirstName"
3. Ignore all irrelevant formatting characters like parentheses, semicolons, brackets, pipes, etc.
4. Extract email addresses accurately - they are the most critical field
5. If you see patterns like "Display Name <email@domain.com>", extract both the name and email
6. Look for company names near the contact (often after a comma or in email domains)
7. Look for job titles (often words like Manager, Director, VP, CEO, Partner, etc.)
8. Phone numbers may be present - extract if clearly associated with a contact
9. Multiple contacts may be separated by newlines, semicolons, or commas - handle all formats
10. Ignore obviously invalid emails or system/no-reply addresses
11. For single-word names or unclear names, just use the name as-is

OUTPUT FORMAT: Return valid JSON with an array of contacts. Each contact must have at minimum an email. Names MUST be in "Surname, FirstName" format (e.g., "Smith, John").`;

    const userPrompt = `Extract all contacts from this pasted text. The text may contain formatting artifacts, separators, and irrelevant characters. Focus on finding names and email addresses.

TEXT TO PARSE:
"""
${pastedText}
"""

Extract every valid contact you can find and return them as JSON.`;

    console.log(`Parsing pasted text (${pastedText.length} chars)`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_contacts',
              description: 'Extract contacts from pasted text data',
              parameters: {
                type: 'object',
                properties: {
                  contacts: {
                    type: 'array',
                    description: 'Array of extracted contacts',
                    items: {
                      type: 'object',
                      properties: {
                        full_name: { 
                          type: 'string', 
                          description: 'Full name in "Surname, FirstName" format (e.g., "Smith, John"). Always use comma to separate surname from first name.' 
                        },
                        email: { 
                          type: 'string', 
                          description: 'Email address in lowercase' 
                        },
                        company: { 
                          type: 'string', 
                          nullable: true,
                          description: 'Company or organization name if detectable' 
                        },
                        job_title: { 
                          type: 'string', 
                          nullable: true,
                          description: 'Job title if detectable' 
                        },
                        phone: { 
                          type: 'string', 
                          nullable: true,
                          description: 'Phone number if present' 
                        }
                      },
                      required: ['full_name', 'email'],
                      additionalProperties: false
                    }
                  },
                  parsing_notes: {
                    type: 'string',
                    description: 'Brief notes about what format was detected and any issues'
                  }
                },
                required: ['contacts'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_contacts' } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI credits exhausted. Please add funds.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('AI gateway error');
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      throw new Error('No valid response from AI');
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const contacts: ExtractedContact[] = parsed.contacts || [];
    const notes = parsed.parsing_notes || '';

    // Validate and clean contacts
    const validContacts = contacts
      .filter(c => c.email && c.email.includes('@'))
      .map(c => ({
        full_name: c.full_name?.trim() || 'Unknown',
        email: c.email.toLowerCase().trim(),
        company: c.company?.trim() || null,
        job_title: c.job_title?.trim() || null,
        phone: c.phone?.trim() || null,
      }));

    // Deduplicate by email
    const seen = new Set<string>();
    const dedupedContacts = validContacts.filter(c => {
      if (seen.has(c.email)) return false;
      seen.add(c.email);
      return true;
    });

    console.log(`Extracted ${dedupedContacts.length} contacts. Notes: ${notes}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        contacts: dedupedContacts,
        count: dedupedContacts.length,
        notes 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Parse error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
