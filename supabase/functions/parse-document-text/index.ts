import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Extract text from DOCX file (which is a ZIP containing XML)
async function extractTextFromDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const zip = new JSZip();
    const contents = await zip.loadAsync(arrayBuffer);
    
    // The main document content is in word/document.xml
    const documentXml = await contents.file("word/document.xml")?.async("string");
    
    if (!documentXml) {
      throw new Error("Could not find document.xml in DOCX file");
    }
    
    // Parse the XML and extract text content
    // Remove XML tags and extract text between <w:t> tags
    const textMatches = documentXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
    const paragraphBreaks = documentXml.match(/<\/w:p>/g) || [];
    
    // Build text by processing the XML structure
    let result = '';
    let currentParagraph = '';
    
    // Split by paragraph markers and process
    const paragraphs = documentXml.split(/<\/w:p>/);
    
    for (const para of paragraphs) {
      const texts = para.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
      const paraText = texts
        .map(t => t.replace(/<w:t[^>]*>([^<]*)<\/w:t>/, '$1'))
        .join('');
      
      if (paraText.trim()) {
        result += paraText + '\n';
      }
    }
    
    return result.trim();
  } catch (error) {
    console.error("Error parsing DOCX:", error);
    throw new Error("Failed to parse Word document");
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
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

    // Check file size limit (5MB for PDFs/Word docs to avoid memory issues)
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (fileSize > MAX_FILE_SIZE) {
      const sizeMB = (fileSize / 1024 / 1024).toFixed(1);
      return new Response(
        JSON.stringify({ error: `File too large (${sizeMB}MB). Maximum size is 5MB. Please use a smaller file or extract the text manually.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let extractedText = '';

    // Handle plain text files
    if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
      extractedText = await file.text();
      console.log('Extracted text from plain text file, length:', extractedText.length);
    }
    // Handle PDF files
    else if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      const arrayBuffer = await file.arrayBuffer();
      // Use Deno's base64 encoder which handles large files properly
      const base64Content = base64Encode(arrayBuffer);
      
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        throw new Error("LOVABLE_API_KEY is not configured");
      }

      console.log('Sending PDF to AI for text extraction, base64 length:', base64Content.length);

      // Use AI to extract text from the PDF
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
                    file_data: `data:application/pdf;base64,${base64Content}`
                  }
                },
                {
                  type: "text",
                  text: "Extract all text content from this PDF document. Return only the extracted text."
                }
              ]
            }
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI gateway error for PDF:", response.status, errorText);
        if (response.status === 429) {
          throw new Error("Rate limit exceeded. Please try again in a moment.");
        }
        if (response.status === 402) {
          throw new Error("AI credits exhausted. Please add credits to continue.");
        }
        throw new Error(`Failed to extract text from PDF: ${response.status}`);
      }

      const data = await response.json();
      extractedText = data.choices?.[0]?.message?.content || '';
      console.log('Extracted text from PDF via AI, length:', extractedText.length);
    }
    // Handle Word documents (.docx) - parse directly using JSZip
    else if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
      fileName.endsWith('.docx')
    ) {
      const arrayBuffer = await file.arrayBuffer();
      console.log('Parsing DOCX file directly...');
      
      extractedText = await extractTextFromDocx(arrayBuffer);
      console.log('Extracted text from DOCX, length:', extractedText.length);
    }
    // Handle old Word documents (.doc) - these are binary and need different handling
    else if (fileType === 'application/msword' || fileName.endsWith('.doc')) {
      return new Response(
        JSON.stringify({ error: 'Old .doc format is not supported. Please save your document as .docx or PDF and try again.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    else {
      return new Response(
        JSON.stringify({ error: `Unsupported file type: ${fileType}. Please upload a PDF, Word document (.docx), or text file.` }),
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
