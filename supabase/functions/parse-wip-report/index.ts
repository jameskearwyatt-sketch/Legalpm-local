import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MatterInfo {
  id: string;
  matter_name: string;
  matter_number: string;
  client_name: string;
  currency: string;
  current_wip: number;
  current_ar: number;
  current_billed: number;
  current_paid: number;
}

interface ColumnMappings {
  matter_number?: number;
  matter_name?: number;
  wip?: number;
  accounts_receivable?: number;
  total_billed?: number;
  total_paid?: number;
}

interface ParsedRow {
  rowIndex: number;
  matterNumber: string;
  matterName: string;
  wip: number;
  accountsReceivable: number;
  totalBilled: number;
  totalPaid: number;
}

interface MatchedData {
  rowIndex: number;
  matterNumber: string;
  matterName: string;
  matchedMatterId: string | null;
  matchedMatterName: string | null;
  matchConfidence: 'high' | 'medium' | 'low' | 'none';
  currency: string;
  wip: { value: number; current: number; changed: boolean };
  accountsReceivable: { value: number; current: number; changed: boolean };
  totalBilled: { value: number; current: number; changed: boolean };
  totalPaid: { value: number; current: number; changed: boolean };
}

const TOLERANCE = 0.005; // 0.5%

function isWithinTolerance(newValue: number, currentValue: number): boolean {
  if (currentValue === 0) return newValue === 0;
  if (newValue === 0 && currentValue === 0) return true;
  const diff = Math.abs(newValue - currentValue) / Math.max(Math.abs(currentValue), 1);
  return diff <= TOLERANCE;
}

function parseNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  // Remove currency symbols, commas, spaces
  const cleaned = value.toString().replace(/[£$€,\s]/g, '').trim();
  if (cleaned === '' || cleaned === '-') return 0;
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function normalizeString(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

function calculateMatchScore(
  importedNumber: string,
  importedName: string,
  matter: MatterInfo
): { score: number; confidence: 'high' | 'medium' | 'low' | 'none' } {
  const normImportedNum = normalizeString(importedNumber);
  const normImportedName = normalizeString(importedName);
  const normMatterNum = normalizeString(matter.matter_number);
  const normMatterName = normalizeString(matter.matter_name);

  let score = 0;

  // Exact matter number match = very high confidence
  if (normImportedNum && normMatterNum && normImportedNum === normMatterNum) {
    score += 100;
  } else if (normImportedNum && normMatterNum && normMatterNum.includes(normImportedNum)) {
    score += 60;
  } else if (normImportedNum && normMatterNum && normImportedNum.includes(normMatterNum)) {
    score += 50;
  }

  // Name matching
  if (normImportedName && normMatterName) {
    if (normImportedName === normMatterName) {
      score += 80;
    } else if (normMatterName.includes(normImportedName) || normImportedName.includes(normMatterName)) {
      score += 40;
    } else {
      // Check for word overlap
      const importedWords = normImportedName.split(/\s+/).filter(w => w.length > 2);
      const matterWords = normMatterName.split(/\s+/).filter(w => w.length > 2);
      const overlap = importedWords.filter(w => matterWords.includes(w)).length;
      if (overlap > 0) {
        score += Math.min(overlap * 15, 30);
      }
    }
  }

  let confidence: 'high' | 'medium' | 'low' | 'none' = 'none';
  if (score >= 100) confidence = 'high';
  else if (score >= 60) confidence = 'medium';
  else if (score >= 30) confidence = 'low';

  return { score, confidence };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rows, columnMappings, matters } = await req.json() as {
      rows: string[][];
      columnMappings: ColumnMappings;
      matters: MatterInfo[];
    };

    console.log(`Processing ${rows.length} rows with mappings:`, columnMappings);
    console.log(`Matching against ${matters.length} matters`);

    // Parse rows according to column mappings
    const parsedRows: ParsedRow[] = rows.map((row, idx) => ({
      rowIndex: idx,
      matterNumber: columnMappings.matter_number !== undefined ? (row[columnMappings.matter_number] || '') : '',
      matterName: columnMappings.matter_name !== undefined ? (row[columnMappings.matter_name] || '') : '',
      wip: columnMappings.wip !== undefined ? parseNumber(row[columnMappings.wip]) : 0,
      accountsReceivable: columnMappings.accounts_receivable !== undefined ? parseNumber(row[columnMappings.accounts_receivable]) : 0,
      totalBilled: columnMappings.total_billed !== undefined ? parseNumber(row[columnMappings.total_billed]) : 0,
      totalPaid: columnMappings.total_paid !== undefined ? parseNumber(row[columnMappings.total_paid]) : 0,
    }));

    // Match each parsed row to a matter
    const matchedData: MatchedData[] = [];
    const unmatchedData: MatchedData[] = [];

    for (const parsed of parsedRows) {
      // Skip rows with no matter identifier
      if (!parsed.matterNumber && !parsed.matterName) continue;

      // Find best match
      let bestMatch: MatterInfo | null = null;
      let bestScore = 0;
      let bestConfidence: 'high' | 'medium' | 'low' | 'none' = 'none';

      for (const matter of matters) {
        const { score, confidence } = calculateMatchScore(
          parsed.matterNumber,
          parsed.matterName,
          matter
        );
        if (score > bestScore) {
          bestScore = score;
          bestMatch = matter;
          bestConfidence = confidence;
        }
      }

      const currency = bestMatch?.currency || 'GBP';
      const currentWip = bestMatch?.current_wip || 0;
      const currentAr = bestMatch?.current_ar || 0;
      const currentBilled = bestMatch?.current_billed || 0;
      const currentPaid = bestMatch?.current_paid || 0;

      const result: MatchedData = {
        rowIndex: parsed.rowIndex,
        matterNumber: parsed.matterNumber,
        matterName: parsed.matterName,
        matchedMatterId: bestMatch?.id || null,
        matchedMatterName: bestMatch?.matter_name || null,
        matchConfidence: bestConfidence,
        currency,
        wip: {
          value: parsed.wip,
          current: currentWip,
          changed: !isWithinTolerance(parsed.wip, currentWip),
        },
        accountsReceivable: {
          value: parsed.accountsReceivable,
          current: currentAr,
          changed: !isWithinTolerance(parsed.accountsReceivable, currentAr),
        },
        totalBilled: {
          value: parsed.totalBilled,
          current: currentBilled,
          changed: !isWithinTolerance(parsed.totalBilled, currentBilled),
        },
        totalPaid: {
          value: parsed.totalPaid,
          current: currentPaid,
          changed: !isWithinTolerance(parsed.totalPaid, currentPaid),
        },
      };

      if (bestMatch && bestConfidence !== 'none') {
        matchedData.push(result);
      } else {
        unmatchedData.push(result);
      }
    }

    console.log(`Matched: ${matchedData.length}, Unmatched: ${unmatchedData.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        matchedData,
        unmatchedData,
        summary: {
          totalRows: rows.length,
          matched: matchedData.length,
          unmatched: unmatchedData.length,
          changedCount: matchedData.filter(d => 
            d.wip.changed || d.accountsReceivable.changed || 
            d.totalBilled.changed || d.totalPaid.changed
          ).length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in parse-wip-report:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
