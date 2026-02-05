import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fileName = file.name.toLowerCase();
    const fileType = file.type;
    const fileSize = file.size;
    console.log(`Processing file: ${file.name}, type: ${fileType}, size: ${fileSize}`);

    const MAX_FILE_SIZE = 15 * 1024 * 1024;
    if (fileSize > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: `File too large. Maximum size is 15MB.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let extractedText = '';

    if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
      extractedText = await file.text();
      console.log('Extracted text from plain text file, length:', extractedText.length);
    }
    else if (
      fileType === 'application/pdf' || fileName.endsWith('.pdf') ||
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
      fileName.endsWith('.docx')
    ) {
      const arrayBuffer = await file.arrayBuffer();
      const base64Content = base64Encode(arrayBuffer);
      
      const mimeType = fileName.endsWith('.pdf') ? 'application/pdf' : 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      
      console.log(`Sending ${mimeType} to AI for text extraction, base64 length: ${base64Content.length}`);

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { 
              role: "system", 
              content: "You are a document text extractor. Extract all text content from the provided document. Return ONLY the raw text content, preserving the structure and formatting as much as possible. Do not add any commentary or explanations." 
            },
            { 
              role: "user", 
              content: [
                {
                  type: "file",
                  file: {
                    filename: file.name,
                    file_data: `data:${mimeType};base64,${base64Content}`
                  }
                },
                {
                  type: "text",
                  text: "Extract all text content from this document. Return only the extracted text."
                }
              ]
            }
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI gateway error:", response.status, errorText);
        if (response.status === 429) {
          throw new Error("Rate limit exceeded. Please try again in a moment.");
        }
        if (response.status === 402) {
          throw new Error("AI credits exhausted. Please add credits to continue.");
        }
        throw new Error(`Failed to extract text: ${response.status}`);
      }

      const data = await response.json();
      extractedText = data.choices?.[0]?.message?.content || '';
      console.log('Extracted text via AI, length:', extractedText.length);
    }
    else if (fileType === 'application/msword' || fileName.endsWith('.doc')) {
      return new Response(
        JSON.stringify({ error: 'Old .doc format is not supported. Please save as .docx or PDF.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    else {
      return new Response(
        JSON.stringify({ error: `Unsupported file type: ${fileType}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!extractedText || extractedText.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Could not extract any text from the document' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ text: extractedText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in parse-document-text:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your document. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
