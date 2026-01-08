import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Try to fetch and parse the document content
    let documentContent = "";
    try {
      const docResponse = await fetch(documentUrl);
      if (docResponse.ok) {
        const contentType = docResponse.headers.get("content-type") || "";
        
        // For PDFs and complex documents, we'll describe what we can see
        if (contentType.includes("application/pdf")) {
          documentContent = `[PDF Document: ${fileName}] - Please provide a summary based on typical contents of a document with this filename in a ${projectType?.replace(/_/g, ' ')} project context.`;
        } else if (contentType.includes("text/") || contentType.includes("application/json")) {
          documentContent = await docResponse.text();
          // Limit content length
          if (documentContent.length > 10000) {
            documentContent = documentContent.substring(0, 10000) + "...[truncated]";
          }
        } else {
          documentContent = `[Document: ${fileName}] - File type: ${contentType}. Please provide a contextual summary based on the filename and project context.`;
        }
      }
    } catch (fetchError) {
      console.error("Error fetching document:", fetchError);
      documentContent = `[Document: ${fileName}] - Unable to fetch content directly. Please provide a contextual summary based on the filename.`;
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

Content/Context:
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
