import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CellInfo {
  address: string;
  value: any;
  formula?: string;
  type: string;
}

interface SheetAnalysis {
  name: string;
  rowCount: number;
  colCount: number;
  cells: CellInfo[];
  usedRange: string;
  // Structured data for easier reading
  headers: string[];
  dataRows: any[][];
}

interface WorkbookAnalysis {
  sheetNames: string[];
  sheets: SheetAnalysis[];
}

serve(async (req) => {
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

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { 
      cellFormula: true,
      cellStyles: true,
      cellNF: true,
    });
    
    const sheets: SheetAnalysis[] = [];
    
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const range = sheet['!ref'];
      const cells: CellInfo[] = [];
      
      // Get all cells with their formulas
      for (const cellAddress in sheet) {
        if (cellAddress.startsWith('!')) continue;
        
        const cell = sheet[cellAddress];
        cells.push({
          address: cellAddress,
          value: cell.v,
          formula: cell.f,
          type: cell.t,
        });
      }
      
      // Calculate dimensions
      const decoded = range ? XLSX.utils.decode_range(range) : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
      
      // Convert to JSON for easier reading
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
      const headers = jsonData[0] || [];
      const dataRows = jsonData.slice(1);
      
      sheets.push({
        name: sheetName,
        rowCount: decoded.e.r - decoded.s.r + 1,
        colCount: decoded.e.c - decoded.s.c + 1,
        cells,
        usedRange: range || 'Empty',
        headers,
        dataRows,
      });
    }
    
    const analysis: WorkbookAnalysis = {
      sheetNames: workbook.SheetNames,
      sheets,
    };

    return new Response(
      JSON.stringify(analysis),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error parsing Excel:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your file. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
