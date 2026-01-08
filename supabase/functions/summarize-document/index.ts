import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    
    let result = '';
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentUrl, fileName, projectName, projectType } = await req.json();

    if (!documentUrl) {
      return new Response(
        JSON.stringify({ error: "documentUrl is required", summary: null }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
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
          throw new Error(`AI gateway error: ${response.status}`);
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
        JSON.stringify({ error: `Failed to access document: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`, summary: null }),
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
      throw new Error(`AI gateway error: ${response.status}`);
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
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error", summary: null }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
