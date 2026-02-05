import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Extract text from DOCX by parsing the XML directly (DOCX is a ZIP file)
async function extractTextFromDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(arrayBuffer);
  
  // Find local file headers in ZIP and locate word/document.xml
  let documentXmlData: Uint8Array | null = null;
  let offset = 0;
  
  while (offset < bytes.length - 30) {
    // Local file header signature: PK\x03\x04
    if (bytes[offset] === 0x50 && bytes[offset + 1] === 0x4b && 
        bytes[offset + 2] === 0x03 && bytes[offset + 3] === 0x04) {
      
      const compressionMethod = bytes[offset + 8] | (bytes[offset + 9] << 8);
      const compressedSize = bytes[offset + 18] | (bytes[offset + 19] << 8) | 
                            (bytes[offset + 20] << 16) | (bytes[offset + 21] << 24);
      const uncompressedSize = bytes[offset + 22] | (bytes[offset + 23] << 8) | 
                              (bytes[offset + 24] << 16) | (bytes[offset + 25] << 24);
      const nameLength = bytes[offset + 26] | (bytes[offset + 27] << 8);
      const extraLength = bytes[offset + 28] | (bytes[offset + 29] << 8);
      
      const nameStart = offset + 30;
      const nameBytes = bytes.slice(nameStart, nameStart + nameLength);
      const fileName = new TextDecoder().decode(nameBytes);
      
      const dataStart = nameStart + nameLength + extraLength;
      
      if (fileName === 'word/document.xml') {
        const fileData = bytes.slice(dataStart, dataStart + compressedSize);
        
        // Decompress if needed (method 8 = deflate)
        if (compressionMethod === 8) {
          try {
            const ds = new DecompressionStream('deflate-raw');
            const writer = ds.writable.getWriter();
            const reader = ds.readable.getReader();
            
            writer.write(fileData);
            writer.close();
            
            const chunks: Uint8Array[] = [];
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              chunks.push(value);
            }
            
            const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
            documentXmlData = new Uint8Array(totalLength);
            let pos = 0;
            for (const chunk of chunks) {
              documentXmlData.set(chunk, pos);
              pos += chunk.length;
            }
          } catch (e) {
            console.error('Decompression failed:', e);
          }
        } else if (compressionMethod === 0) {
          // Stored (uncompressed)
          documentXmlData = fileData;
        }
        break;
      }
      
      offset = dataStart + compressedSize;
    } else {
      offset++;
    }
  }
  
  if (!documentXmlData) {
    throw new Error('Could not find document.xml in DOCX');
  }
  
  const xmlContent = new TextDecoder().decode(documentXmlData);
  
  // Extract text from paragraphs
  const paragraphs = xmlContent.split(/<\/w:p>/);
  let result = '';
  
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
}

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
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
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

    console.log(`Processing: ${file.name}, size: ${file.size}`);

    if (file.size > 15 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: 'File too large. Max 15MB.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fileName = file.name.toLowerCase();
    let extractedText = '';

    if (fileName.endsWith('.txt')) {
      extractedText = await file.text();
      console.log('Text file, length:', extractedText.length);
    } 
    else if (fileName.endsWith('.docx')) {
      // Parse DOCX directly
      const arrayBuffer = await file.arrayBuffer();
      extractedText = await extractTextFromDocx(arrayBuffer);
      console.log('DOCX extracted, length:', extractedText.length);
    }
    else if (fileName.endsWith('.pdf')) {
      // Use AI for PDFs
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        throw new Error("LOVABLE_API_KEY not configured");
      }
      
      const arrayBuffer = await file.arrayBuffer();
      const base64Content = toBase64(arrayBuffer);

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "Extract all text from this PDF document. Return only the raw text." },
            { 
              role: "user", 
              content: [
                { type: "file", file: { filename: file.name, file_data: `data:application/pdf;base64,${base64Content}` } },
                { type: "text", text: "Extract all text content from this PDF." }
              ]
            }
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('AI error:', response.status, errText);
        throw new Error(`PDF extraction failed: ${response.status}`);
      }

      const data = await response.json();
      extractedText = data.choices?.[0]?.message?.content || '';
      console.log('PDF extracted via AI, length:', extractedText.length);
    } 
    else if (fileName.endsWith('.doc')) {
      return new Response(
        JSON.stringify({ error: '.doc not supported. Please save as .docx or PDF.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } 
    else {
      return new Response(
        JSON.stringify({ error: 'Unsupported file type. Use PDF, DOCX, or TXT.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!extractedText?.trim()) {
      return new Response(
        JSON.stringify({ error: 'No text could be extracted from document' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ text: extractedText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Processing failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
