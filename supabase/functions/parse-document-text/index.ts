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

// Decompress a single ZIP entry
async function decompressEntry(fileData: Uint8Array, compressionMethod: number): Promise<Uint8Array | null> {
  if (compressionMethod === 0) return fileData; // stored
  if (compressionMethod !== 8) return null; // only deflate supported
  try {
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    const reader = ds.readable.getReader();
    writer.write(new Uint8Array(fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength) as ArrayBuffer));
    writer.close();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const result = new Uint8Array(totalLength);
    let pos = 0;
    for (const chunk of chunks) { result.set(chunk, pos); pos += chunk.length; }
    return result;
  } catch (e) {
    console.error('Decompression failed:', e);
    return null;
  }
}

// Extract ALL matching XML files from a DOCX ZIP archive
async function extractZipEntries(bytes: Uint8Array, targetNames: string[]): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const targetSet = new Set(targetNames);
  let offset = 0;

  while (offset < bytes.length - 30) {
    if (bytes[offset] === 0x50 && bytes[offset + 1] === 0x4b &&
        bytes[offset + 2] === 0x03 && bytes[offset + 3] === 0x04) {
      const compressionMethod = bytes[offset + 8] | (bytes[offset + 9] << 8);
      const compressedSize = bytes[offset + 18] | (bytes[offset + 19] << 8) |
                            (bytes[offset + 20] << 16) | (bytes[offset + 21] << 24);
      const nameLength = bytes[offset + 26] | (bytes[offset + 27] << 8);
      const extraLength = bytes[offset + 28] | (bytes[offset + 29] << 8);
      const nameStart = offset + 30;
      const fileName = new TextDecoder().decode(bytes.slice(nameStart, nameStart + nameLength));
      const dataStart = nameStart + nameLength + extraLength;

      if (targetSet.has(fileName)) {
        const fileData = bytes.slice(dataStart, dataStart + compressedSize);
        const decompressed = await decompressEntry(fileData, compressionMethod);
        if (decompressed) {
          results.set(fileName, new TextDecoder().decode(decompressed));
        }
      }
      offset = dataStart + compressedSize;
    } else {
      offset++;
    }
  }
  return results;
}

// Decode XML entities
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// Extract text from OOXML content, handling paragraphs, tables, tabs, breaks
function extractTextFromXml(xmlContent: string): string {
  const lines: string[] = [];

  // Process paragraph by paragraph
  const paragraphs = xmlContent.split(/<\/w:p>/);
  for (const para of paragraphs) {
    let paraText = '';

    // Process each run and text element in order
    // Split by run boundaries to maintain order
    const segments = para.split(/<w:r[ >]/);
    for (const segment of segments) {
      // Handle tabs -> insert tab character
      if (segment.includes('<w:tab/>') || segment.includes('<w:tab />')) {
        paraText += '\t';
      }
      // Handle line breaks
      if (segment.includes('<w:br')) {
        paraText += '\n';
      }

      // Extract all <w:t> text (handles xml:space="preserve" and regular)
      const textMatches = segment.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g);
      for (const m of textMatches) {
        paraText += decodeXmlEntities(m[1]);
      }
    }

    // Also catch any <w:t> outside of runs (rare but possible)
    if (!paraText.trim()) {
      const fallbackMatches = para.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g);
      for (const m of fallbackMatches) {
        paraText += decodeXmlEntities(m[1]);
      }
    }

    if (paraText.trim()) {
      lines.push(paraText);
    }
  }

  return lines.join('\n');
}

// Extract text from DOCX by parsing all relevant XML parts
async function extractTextFromDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(arrayBuffer);

  // Extract from all content-bearing parts of the DOCX
  const targetFiles = [
    'word/document.xml',
    'word/header1.xml', 'word/header2.xml', 'word/header3.xml',
    'word/footer1.xml', 'word/footer2.xml', 'word/footer3.xml',
    'word/footnotes.xml', 'word/endnotes.xml',
  ];

  const xmlEntries = await extractZipEntries(bytes, targetFiles);

  if (!xmlEntries.has('word/document.xml')) {
    throw new Error('Could not find document.xml in DOCX');
  }

  // Build output: headers first, then main body, then footnotes/endnotes
  const sections: string[] = [];

  // Headers
  for (const key of ['word/header1.xml', 'word/header2.xml', 'word/header3.xml']) {
    const xml = xmlEntries.get(key);
    if (xml) {
      const text = extractTextFromXml(xml).trim();
      if (text) sections.push(text);
    }
  }

  // Main document body
  const mainText = extractTextFromXml(xmlEntries.get('word/document.xml')!).trim();
  if (mainText) sections.push(mainText);

  // Footers
  for (const key of ['word/footer1.xml', 'word/footer2.xml', 'word/footer3.xml']) {
    const xml = xmlEntries.get(key);
    if (xml) {
      const text = extractTextFromXml(xml).trim();
      if (text) sections.push(text);
    }
  }

  // Footnotes & endnotes (skip default entries which are usually empty)
  for (const key of ['word/footnotes.xml', 'word/endnotes.xml']) {
    const xml = xmlEntries.get(key);
    if (xml) {
      const text = extractTextFromXml(xml).trim();
      // Footnotes/endnotes files always have a couple of empty default entries
      if (text && text.length > 10) sections.push(text);
    }
  }

  const result = sections.join('\n\n');
  console.log(`DOCX extraction: ${xmlEntries.size} XML parts processed, ${result.length} chars extracted`);
  return result;
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
