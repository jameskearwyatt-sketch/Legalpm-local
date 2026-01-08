import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Extract text from DOCX file (which is a ZIP containing XML)
async function extractTextFromDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const zip = new JSZip();
    const contents = await zip.loadAsync(arrayBuffer);
    
    const documentXml = await contents.file("word/document.xml")?.async("string");
    
    if (!documentXml) {
      throw new Error("Could not find document.xml in DOCX file");
    }
    
    // Remove XML tags and extract text content
    // First, replace paragraph endings with newlines
    let text = documentXml.replace(/<\/w:p>/g, '\n');
    // Extract text between w:t tags (including those with attributes like xml:space)
    const textMatches = text.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
    const extractedTexts = textMatches.map(match => {
      const content = match.replace(/<w:t[^>]*>([^<]*)<\/w:t>/, '$1');
      return content;
    });
    
    // Join and clean up
    let result = extractedTexts.join('').replace(/\n+/g, '\n').trim();
    
    // If we got very little text, try a more aggressive approach
    if (result.length < 50) {
      // Strip all XML tags and get raw text
      result = documentXml
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    console.log("DOCX extracted text preview:", result.substring(0, 200));
    return result;
  } catch (error) {
    console.error("Error parsing DOCX:", error);
    throw new Error("Failed to parse Word document");
  }
}

// Extract text from PPTX file (PowerPoint)
async function extractTextFromPptx(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const zip = new JSZip();
    const contents = await zip.loadAsync(arrayBuffer);
    
    const allText: string[] = [];
    
    // PPTX stores slides in ppt/slides/slide1.xml, slide2.xml, etc.
    const slideFiles = Object.keys(contents.files)
      .filter(name => name.match(/ppt\/slides\/slide\d+\.xml$/))
      .sort((a, b) => {
        const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || '0');
        const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || '0');
        return numA - numB;
      });
    
    console.log("Found slides:", slideFiles.length);
    
    for (const slideFile of slideFiles) {
      const slideXml = await contents.file(slideFile)?.async("string");
      if (slideXml) {
        // Extract text from a:t tags (text elements in PPTX)
        const textMatches = slideXml.match(/<a:t>([^<]*)<\/a:t>/g) || [];
        const slideTexts = textMatches.map(match => 
          match.replace(/<a:t>([^<]*)<\/a:t>/, '$1')
        ).filter(t => t.trim());
        
        if (slideTexts.length > 0) {
          const slideNum = slideFile.match(/slide(\d+)\.xml/)?.[1] || '?';
          allText.push(`[Slide ${slideNum}]\n${slideTexts.join(' ')}`);
        }
      }
    }
    
    const result = allText.join('\n\n').trim();
    console.log("PPTX extracted text preview:", result.substring(0, 200));
    return result;
  } catch (error) {
    console.error("Error parsing PPTX:", error);
    throw new Error("Failed to parse PowerPoint document");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authorization required', summary: null }),
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
        JSON.stringify({ error: 'Invalid or expired token', summary: null }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { documentUrl, fileName, projectName, projectType } = await req.json();

    if (!documentUrl) {
      return new Response(
        JSON.stringify({ error: "documentUrl is required", summary: null }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Service temporarily unavailable. Please try again later.", summary: null }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let documentContent = "";
    const lowerFileName = (fileName || "").toLowerCase();

    try {
      console.log("Fetching document from:", documentUrl);
      const docResponse = await fetch(documentUrl);
      
      if (!docResponse.ok) {
        throw new Error(`Failed to fetch document: ${docResponse.status}`);
      }

      const contentType = docResponse.headers.get("content-type") || "";
      console.log("Content type:", contentType);

      // Handle DOCX files
      if (
        contentType.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document") ||
        lowerFileName.endsWith(".docx")
      ) {
        console.log("Parsing DOCX file...");
        const arrayBuffer = await docResponse.arrayBuffer();
        documentContent = await extractTextFromDocx(arrayBuffer);
        console.log("Extracted text length:", documentContent.length);
      }
      // Handle PPTX files (PowerPoint)
      else if (
        contentType.includes("application/vnd.openxmlformats-officedocument.presentationml.presentation") ||
        lowerFileName.endsWith(".pptx")
      ) {
        console.log("Parsing PPTX file...");
        const arrayBuffer = await docResponse.arrayBuffer();
        documentContent = await extractTextFromPptx(arrayBuffer);
        console.log("Extracted text length:", documentContent.length);
      }
      // Handle PDF files - send to AI with file data
      else if (contentType.includes("application/pdf") || lowerFileName.endsWith(".pdf")) {
        console.log("Processing PDF file...");
        const arrayBuffer = await docResponse.arrayBuffer();
        const base64Content = base64Encode(arrayBuffer);
        
        // Use AI to extract and summarize PDF in one go
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
                content: `You are a helpful assistant that summarizes documents for a ${projectType?.replace(/_/g, ' ') || 'growth'} project. 
Provide a clear, concise summary that captures:
- The main purpose/topic of the document
- Key points or takeaways
- Any action items or next steps mentioned
- Relevance to the project

Keep your summary to 2-4 sentences, focused and actionable.`
              },
              { 
                role: "user", 
                content: [
                  {
                    type: "file",
                    file: {
                      filename: fileName || "document.pdf",
                      file_data: `data:application/pdf;base64,${base64Content}`
                    }
                  },
                  {
                    type: "text",
                    text: `Project: ${projectName || 'Untitled Project'}\n\nPlease provide a helpful summary of this document.`
                  }
                ]
              }
            ],
          }),
        });

        if (!response.ok) {
          if (response.status === 429) {
            return new Response(
              JSON.stringify({ error: "Rate limit exceeded. Please try again later.", summary: null }),
              { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          if (response.status === 402) {
            return new Response(
              JSON.stringify({ error: "AI credits exhausted. Please add credits.", summary: null }),
              { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          console.error("AI gateway error:", response.status);
          return new Response(
            JSON.stringify({ error: "An error occurred processing your document. Please try again.", summary: null }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const data = await response.json();
        const summary = data.choices?.[0]?.message?.content || "Unable to generate summary.";
        
        return new Response(
          JSON.stringify({ summary }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Handle plain text files
      else if (contentType.includes("text/") || lowerFileName.endsWith(".txt") || lowerFileName.endsWith(".md")) {
        documentContent = await docResponse.text();
        if (documentContent.length > 10000) {
          documentContent = documentContent.substring(0, 10000) + "...[truncated]";
        }
      }
      // Handle Excel files - basic info only
      else if (
        contentType.includes("spreadsheet") || 
        lowerFileName.endsWith(".xlsx") || 
        lowerFileName.endsWith(".xls")
      ) {
        documentContent = `[Excel Spreadsheet: ${fileName}] - This is a spreadsheet document. Key information may include data tables, financial figures, or structured information relevant to the ${projectType?.replace(/_/g, ' ')} project.`;
      }
      // Other file types
      else {
        documentContent = `[Document: ${fileName}] - File type: ${contentType}. Unable to parse content directly.`;
      }

    } catch (fetchError) {
      console.error("Error fetching/parsing document:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to access document. Please ensure it exists and try again.", summary: null }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If we have document content, send it to AI for summarization
    if (!documentContent || documentContent.length < 10) {
      return new Response(
        JSON.stringify({ error: "Could not extract content from document", summary: null }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const projectTypeLabel = projectType?.replace(/_/g, ' ') || 'growth';

    const systemPrompt = `You are a helpful assistant that summarizes documents for a ${projectTypeLabel} project. 
Provide a clear, concise summary that captures:
- The main purpose/topic of the document
- Key points or takeaways
- Any action items or next steps mentioned
- Relevance to the project

Keep your summary to 2-4 sentences, focused and actionable.`;

    const userPrompt = `Project: ${projectName || 'Untitled Project'}
Document: ${fileName}

Content:
${documentContent}

Please provide a helpful summary of this document.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later.", summary: null }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits.", summary: null }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "An error occurred processing your document. Please try again.", summary: null }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content || "Unable to generate summary.";

    return new Response(
      JSON.stringify({ summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in summarize-document:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred processing your document. Please try again.", summary: null }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
