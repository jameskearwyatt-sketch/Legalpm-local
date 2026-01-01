import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    console.log(`Processing file: ${file.name}, type: ${fileType}, size: ${file.size}`);

    let extractedText = '';

    // Handle plain text files
    if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
      extractedText = await file.text();
      console.log('Extracted text from plain text file, length:', extractedText.length);
    }
    // Handle PDF files using pdf-parse via external service or basic extraction
    else if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      // Use Lovable AI to extract text from PDF via the document parsing gateway
      const arrayBuffer = await file.arrayBuffer();
      const base64Content = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        throw new Error("LOVABLE_API_KEY is not configured");
      }

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
        throw new Error(`Failed to extract text from PDF: ${response.status}`);
      }

      const data = await response.json();
      extractedText = data.choices?.[0]?.message?.content || '';
      console.log('Extracted text from PDF via AI, length:', extractedText.length);
    }
    // Handle Word documents (.docx)
    else if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
      fileName.endsWith('.docx') ||
      fileType === 'application/msword' ||
      fileName.endsWith('.doc')
    ) {
      const arrayBuffer = await file.arrayBuffer();
      const base64Content = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        throw new Error("LOVABLE_API_KEY is not configured");
      }

      // Determine the mime type
      const mimeType = fileName.endsWith('.docx') 
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/msword';

      // Use AI to extract text from the Word document
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
                  text: "Extract all text content from this Word document. Return only the extracted text."
                }
              ]
            }
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI gateway error for Word:", response.status, errorText);
        throw new Error(`Failed to extract text from Word document: ${response.status}`);
      }

      const data = await response.json();
      extractedText = data.choices?.[0]?.message?.content || '';
      console.log('Extracted text from Word via AI, length:', extractedText.length);
    }
    else {
      return new Response(
        JSON.stringify({ error: `Unsupported file type: ${fileType}. Please upload a PDF, Word document, or text file.` }),
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
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
