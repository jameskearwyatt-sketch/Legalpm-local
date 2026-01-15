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
  client_name?: number;
  wip?: number;
  accounts_receivable?: number;
  total_billed?: number;
  total_paid?: number;
}

interface ParsedRow {
  rowIndex: number;
  matterNumber: string;
  matterName: string;
  clientName: string;
  wip: number;
  accountsReceivable: number;
  totalBilled: number;
  totalPaid: number;
}

interface MatterMapping {
  imported_matter_number: string | null;
  imported_matter_name: string | null;
  imported_client_name: string | null;
  mapped_matter_id: string;
}

interface MatchedData {
  rowIndex: number;
  matterNumber: string;
  matterName: string;
  clientName: string;
  matchedMatterId: string | null;
  matchedMatterName: string | null;
  matchConfidence: 'high' | 'medium' | 'low' | 'none';
  needsConfirmation: boolean;
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
  importedClientName: string,
  matter: MatterInfo
): { score: number; confidence: 'high' | 'medium' | 'low' | 'none' } {
  const normImportedNum = normalizeString(importedNumber);
  const normImportedName = normalizeString(importedName);
  const normImportedClient = normalizeString(importedClientName);
  const normMatterNum = normalizeString(matter.matter_number);
  const normMatterName = normalizeString(matter.matter_name);
  const normClientName = normalizeString(matter.client_name);

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

  // Client name matching - helps differentiate similar matters
  if (normImportedClient && normClientName) {
    if (normImportedClient === normClientName) {
      score += 50;
    } else if (normClientName.includes(normImportedClient) || normImportedClient.includes(normClientName)) {
      score += 25;
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
    const { rows, columnMappings, matters, savedMappings } = await req.json() as {
      rows: string[][];
      columnMappings: ColumnMappings;
      matters: MatterInfo[];
      savedMappings?: MatterMapping[];
    };

    console.log(`Processing ${rows.length} rows with mappings:`, columnMappings);
    console.log(`Matching against ${matters.length} matters`);
    console.log(`Using ${savedMappings?.length || 0} saved mappings`);

    // Parse rows according to column mappings
    const parsedRows: ParsedRow[] = rows.map((row, idx) => ({
      rowIndex: idx,
      matterNumber: columnMappings.matter_number !== undefined ? (row[columnMappings.matter_number] || '') : '',
      matterName: columnMappings.matter_name !== undefined ? (row[columnMappings.matter_name] || '') : '',
      clientName: columnMappings.client_name !== undefined ? (row[columnMappings.client_name] || '') : '',
      wip: columnMappings.wip !== undefined ? parseNumber(row[columnMappings.wip]) : 0,
      accountsReceivable: columnMappings.accounts_receivable !== undefined ? parseNumber(row[columnMappings.accounts_receivable]) : 0,
      totalBilled: columnMappings.total_billed !== undefined ? parseNumber(row[columnMappings.total_billed]) : 0,
      totalPaid: columnMappings.total_paid !== undefined ? parseNumber(row[columnMappings.total_paid]) : 0,
    }));

    // Match each parsed row to a matter
    const matchedData: MatchedData[] = [];
    const unmatchedData: MatchedData[] = [];
    const lowConfidenceData: MatchedData[] = [];

    for (const parsed of parsedRows) {
      // Skip rows with no matter identifier
      if (!parsed.matterNumber && !parsed.matterName) continue;

      // First, check for a saved mapping
      const savedMapping = savedMappings?.find(
        m => m.imported_matter_number === parsed.matterNumber && 
             m.imported_matter_name === parsed.matterName
      );

      let bestMatch: MatterInfo | null = null;
      let bestConfidence: 'high' | 'medium' | 'low' | 'none' = 'none';
      let usedSavedMapping = false;

      if (savedMapping) {
        // Use saved mapping
        bestMatch = matters.find(m => m.id === savedMapping.mapped_matter_id) || null;
        if (bestMatch) {
          bestConfidence = 'high';
          usedSavedMapping = true;
        }
      }

      if (!bestMatch) {
        // Find best match using algorithm
        let bestScore = 0;

        for (const matter of matters) {
          const { score, confidence } = calculateMatchScore(
            parsed.matterNumber,
            parsed.matterName,
            parsed.clientName,
            matter
          );
          if (score > bestScore) {
            bestScore = score;
            bestMatch = matter;
            bestConfidence = confidence;
          }
        }
      }

      const currency = bestMatch?.currency || 'GBP';
      const currentWip = bestMatch?.current_wip || 0;
      const currentAr = bestMatch?.current_ar || 0;
      const currentBilled = bestMatch?.current_billed || 0;
      const currentPaid = bestMatch?.current_paid || 0;

      // Determine if this needs user confirmation
      const needsConfirmation = !usedSavedMapping && bestConfidence !== 'high' && bestMatch !== null;

      const result: MatchedData = {
        rowIndex: parsed.rowIndex,
        matterNumber: parsed.matterNumber,
        matterName: parsed.matterName,
        clientName: parsed.clientName,
        matchedMatterId: bestMatch?.id || null,
        matchedMatterName: bestMatch?.matter_name || null,
        matchConfidence: bestConfidence,
        needsConfirmation,
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
        if (needsConfirmation) {
          lowConfidenceData.push(result);
        } else {
          matchedData.push(result);
        }
      } else {
        unmatchedData.push(result);
      }
    }

    console.log(`Matched: ${matchedData.length}, Low confidence: ${lowConfidenceData.length}, Unmatched: ${unmatchedData.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        matchedData,
        lowConfidenceData,
        unmatchedData,
        summary: {
          totalRows: rows.length,
          matched: matchedData.length,
          lowConfidence: lowConfidenceData.length,
          unmatched: unmatchedData.length,
          changedCount: [...matchedData, ...lowConfidenceData].filter(d => 
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
