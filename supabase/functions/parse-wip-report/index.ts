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
  cm_number?: string;
  currency: string;
  current_wip: number;
  current_wip_write_off: number;
  current_ar: number;
  current_billed: number;
  current_paid: number;
  is_multi_client?: boolean;
}

interface ColumnMappings {
  matter_number?: number;
  matter_name?: number;
  client_name?: number;
  wip?: number;
  wip_write_off?: number; // Write-offs column
  accounts_receivable?: number;
  total_billed?: number;
  total_paid?: number;
  // Disbursement columns for local counsel tracking
  wip_disbursements?: number;
  ar_disbursements?: number;
  paid_disbursements?: number;
}

interface ParsedRow {
  rowIndex: number;
  matterNumber: string;
  matterName: string;
  clientName: string;
  wip: number;
  wipWriteOff: number; // Write-off amount
  accountsReceivable: number;
  totalBilled: number;
  totalPaid: number;
  // Disbursement data
  wipDisbursement: number;
  arDisbursement: number;
  paidDisbursement: number;
}

interface MatterMapping {
  imported_matter_number: string | null;
  imported_matter_name: string | null;
  imported_client_name: string | null;
  mapped_matter_id: string;
}

interface MatchedData {
  rowIndex: number;
  rowIndices?: number[]; // For aggregated multi-client rows
  matterNumber: string;
  matterName: string;
  clientName: string;
  clientNames?: string[]; // For multi-client matters, track all client names
  matchedMatterId: string | null;
  matchedMatterName: string | null;
  matchConfidence: 'high' | 'medium' | 'low' | 'none';
  needsConfirmation: boolean;
  isMultiClientAggregate?: boolean;
  currency: string;
  wip: { value: number; current: number; changed: boolean };
  wipWriteOff: { value: number; current: number; changed: boolean };
  accountsReceivable: { value: number; current: number; changed: boolean };
  totalBilled: { value: number; current: number; changed: boolean };
  totalPaid: { value: number; current: number; changed: boolean };
  // Disbursement data for local counsel detection
  wipDisbursement: number;
  arDisbursement: number;
  paidDisbursement: number;
}

// Detect ANY difference - even tiny ones. The frontend handles material vs immaterial categorization.
// We want to flag all changes so users can see them, then let the UI group them appropriately.
function isWithinTolerance(newValue: number, currentValue: number): boolean {
  // Only consider identical values as "within tolerance"
  // Any difference, no matter how small, should be flagged as a change
  if (currentValue === 0 && newValue === 0) return true;
  // Use a tiny epsilon for floating point comparison only
  const epsilon = 0.001; // Less than 1 cent/penny difference
  return Math.abs(newValue - currentValue) < epsilon;
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

// Normalize for mapping comparison - less aggressive, keeps more structure
function normalizeForMapping(str: string | null | undefined): string {
  if (!str) return '';
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
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

  let matterNumberScore = 0;
  let matterNameScore = 0;
  let clientNameScore = 0;

  // Exact matter number match = very high confidence
  if (normImportedNum && normMatterNum && normImportedNum === normMatterNum) {
    matterNumberScore = 100;
  } else if (normImportedNum && normMatterNum && normMatterNum.includes(normImportedNum)) {
    matterNumberScore = 60;
  } else if (normImportedNum && normMatterNum && normImportedNum.includes(normMatterNum)) {
    matterNumberScore = 50;
  }

  // Name matching
  if (normImportedName && normMatterName) {
    if (normImportedName === normMatterName) {
      matterNameScore = 80;
    } else if (normMatterName.includes(normImportedName) || normImportedName.includes(normMatterName)) {
      matterNameScore = 40;
    } else {
      // Check for word overlap - but require significant overlap to count
      const importedWords = normImportedName.split(/\s+/).filter(w => w.length > 2);
      const matterWords = normMatterName.split(/\s+/).filter(w => w.length > 2);
      const overlap = importedWords.filter(w => matterWords.includes(w)).length;
      // Require at least 2 word matches to count, or 1 if there's only 1-2 words
      const minRequired = Math.min(2, importedWords.length);
      if (overlap >= minRequired && overlap > 0) {
        matterNameScore = Math.min(overlap * 15, 30);
      }
    }
  }

  // Client name matching - ONLY use as a tiebreaker/boost if we already have a matter match
  // Client name alone should NEVER be enough to create a match
  if (normImportedClient && normClientName) {
    if (normImportedClient === normClientName) {
      clientNameScore = 25; // Reduced from 50
    } else if (normClientName.includes(normImportedClient) || normImportedClient.includes(normClientName)) {
      clientNameScore = 10; // Reduced from 25
    }
  }

  // CRITICAL: Only count client name score if we have at least SOME match on matter number OR matter name
  // This prevents matching unrelated matters just because they share the same client
  const hasMatterMatch = matterNumberScore >= 50 || matterNameScore >= 30;
  const score = matterNumberScore + matterNameScore + (hasMatterMatch ? clientNameScore : 0);

  let confidence: 'high' | 'medium' | 'low' | 'none' = 'none';
  // Raise thresholds to be more strict about what counts as a match
  if (score >= 100) confidence = 'high';
  else if (score >= 70) confidence = 'medium'; // Raised from 60
  else if (score >= 40) confidence = 'low';    // Raised from 30
  // Below 40 = 'none' - will be unmatched

  return { score, confidence };
}

// Find a saved mapping using normalized comparison
function findSavedMapping(
  matterNumber: string,
  matterName: string,
  clientName: string,
  savedMappings: MatterMapping[] | undefined
): MatterMapping | undefined {
  if (!savedMappings || savedMappings.length === 0) return undefined;

  const normNum = normalizeForMapping(matterNumber);
  const normName = normalizeForMapping(matterName);
  const normClient = normalizeForMapping(clientName);

  // First, try exact normalized match on number + name
  let match = savedMappings.find(m => {
    const mapNum = normalizeForMapping(m.imported_matter_number);
    const mapName = normalizeForMapping(m.imported_matter_name);
    return mapNum === normNum && mapName === normName;
  });

  if (match) return match;

  // If no match, try matching on just matter number (if present)
  if (normNum) {
    match = savedMappings.find(m => {
      const mapNum = normalizeForMapping(m.imported_matter_number);
      return mapNum && mapNum === normNum;
    });
    if (match) return match;
  }

  // Try matching on matter name + client name
  if (normName && normClient) {
    match = savedMappings.find(m => {
      const mapName = normalizeForMapping(m.imported_matter_name);
      const mapClient = normalizeForMapping(m.imported_client_name);
      return mapName === normName && mapClient === normClient;
    });
    if (match) return match;
  }

  return undefined;
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
      wipWriteOff: columnMappings.wip_write_off !== undefined ? parseNumber(row[columnMappings.wip_write_off]) : 0,
      accountsReceivable: columnMappings.accounts_receivable !== undefined ? parseNumber(row[columnMappings.accounts_receivable]) : 0,
      totalBilled: columnMappings.total_billed !== undefined ? parseNumber(row[columnMappings.total_billed]) : 0,
      totalPaid: columnMappings.total_paid !== undefined ? parseNumber(row[columnMappings.total_paid]) : 0,
      // Disbursement data
      wipDisbursement: columnMappings.wip_disbursements !== undefined ? parseNumber(row[columnMappings.wip_disbursements]) : 0,
      arDisbursement: columnMappings.ar_disbursements !== undefined ? parseNumber(row[columnMappings.ar_disbursements]) : 0,
      paidDisbursement: columnMappings.paid_disbursements !== undefined ? parseNumber(row[columnMappings.paid_disbursements]) : 0,
    }));

    // First pass: match each row to a matter
    interface RowMatch {
      parsed: ParsedRow;
      matterId: string | null;
      matterName: string | null;
      confidence: 'high' | 'medium' | 'low' | 'none';
      usedSavedMapping: boolean;
      matter: MatterInfo | null;
    }

    const rowMatches: RowMatch[] = [];

    for (const parsed of parsedRows) {
      // Skip rows with no matter identifier
      if (!parsed.matterNumber && !parsed.matterName) continue;

      // Check for a saved mapping using normalized comparison
      const savedMapping = findSavedMapping(
        parsed.matterNumber,
        parsed.matterName,
        parsed.clientName,
        savedMappings
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

      rowMatches.push({
        parsed,
        matterId: bestMatch?.id || null,
        matterName: bestMatch?.matter_name || null,
        confidence: bestConfidence,
        usedSavedMapping,
        matter: bestMatch,
      });
    }

    // NEW: Detect potential multi-client aggregation candidates
    // Look for rows with identical (normalized) matter names but different matter numbers or client names
    // These are rows that the user might want to aggregate
    const nameGroups = new Map<string, RowMatch[]>();
    for (const match of rowMatches) {
      const normName = normalizeString(match.parsed.matterName);
      if (!normName) continue;
      if (!nameGroups.has(normName)) {
        nameGroups.set(normName, []);
      }
      nameGroups.get(normName)!.push(match);
    }

    // Identify groups where rows share the same matter name but have different matter numbers or client names
    // AND are NOT already matched to a multi-client matter
    interface PotentialAggregation {
      matterName: string;
      rows: Array<{
        rowIndex: number;
        matterNumber: string;
        clientName: string;
        wip: number;
        wipWriteOff: number;
        accountsReceivable: number;
        totalBilled: number;
        totalPaid: number;
        wipDisbursement: number;
        arDisbursement: number;
        paidDisbursement: number;
        matchedMatterId: string | null;
        matchedMatterName: string | null;
        confidence: string;
      }>;
      totalWip: number;
      totalWipWriteOff: number;
      totalAr: number;
      totalBilled: number;
      totalPaid: number;
    }

    const potentialAggregations: PotentialAggregation[] = [];
    const autoAggregatedRowIndices = new Set<number>();

    for (const [normName, group] of nameGroups) {
      if (group.length < 2) continue;

      // Check that at least some rows have different matter numbers or client names
      const matterNumbers = new Set(group.map(g => normalizeString(g.parsed.matterNumber)).filter(Boolean));
      const clientNames = new Set(group.map(g => normalizeString(g.parsed.clientName)).filter(Boolean));
      
      // If all rows have the exact same matter number AND client name, they're duplicates not multi-client
      if (matterNumbers.size <= 1 && clientNames.size <= 1) continue;

      // Check if any of these are already matched to a multi-client matter
      const allMatchedToSameMultiClient = group.every(g => 
        g.matterId && g.matter?.is_multi_client && g.matterId === group[0].matterId
      );
      if (allMatchedToSameMultiClient) continue; // Already handled by existing logic

      // This is a potential aggregation candidate - flag it for user decision
      const agg: PotentialAggregation = {
        matterName: group[0].parsed.matterName,
        rows: group.map(g => ({
          rowIndex: g.parsed.rowIndex,
          matterNumber: g.parsed.matterNumber,
          clientName: g.parsed.clientName,
          wip: g.parsed.wip,
          wipWriteOff: g.parsed.wipWriteOff,
          accountsReceivable: g.parsed.accountsReceivable,
          totalBilled: g.parsed.totalBilled,
          totalPaid: g.parsed.totalPaid,
          wipDisbursement: g.parsed.wipDisbursement,
          arDisbursement: g.parsed.arDisbursement,
          paidDisbursement: g.parsed.paidDisbursement,
          matchedMatterId: g.matterId,
          matchedMatterName: g.matterName,
          confidence: g.confidence,
        })),
        totalWip: group.reduce((s, g) => s + g.parsed.wip, 0),
        totalWipWriteOff: group.reduce((s, g) => s + g.parsed.wipWriteOff, 0),
        totalAr: group.reduce((s, g) => s + g.parsed.accountsReceivable, 0),
        totalBilled: group.reduce((s, g) => s + g.parsed.totalBilled, 0),
        totalPaid: group.reduce((s, g) => s + g.parsed.totalPaid, 0),
      };
      potentialAggregations.push(agg);
    }

    // Second pass: aggregate rows that match the same multi-client matter
    const matterAggregates = new Map<string, {
      rowIndices: number[];
      clientNames: string[];
      totalWip: number;
      totalWipWriteOff: number;
      totalAr: number;
      totalBilled: number;
      totalPaid: number;
      totalWipDisbursement: number;
      totalArDisbursement: number;
      totalPaidDisbursement: number;
      matter: MatterInfo;
      confidence: 'high' | 'medium' | 'low' | 'none';
      usedSavedMapping: boolean;
      firstRow: ParsedRow;
    }>();

    const unmatchedRows: RowMatch[] = [];
    const processedRowIndices = new Set<number>();

    for (const match of rowMatches) {
      if (!match.matterId || match.confidence === 'none') {
        unmatchedRows.push(match);
        continue;
      }

      const matter = match.matter!;
      
      // Check if this matter is multi-client
      if (matter.is_multi_client) {
        const existing = matterAggregates.get(match.matterId);
        if (existing) {
          // Aggregate with existing
          existing.rowIndices.push(match.parsed.rowIndex);
          if (match.parsed.clientName && !existing.clientNames.includes(match.parsed.clientName)) {
            existing.clientNames.push(match.parsed.clientName);
          }
          existing.totalWip += match.parsed.wip;
          existing.totalWipWriteOff += match.parsed.wipWriteOff;
          existing.totalAr += match.parsed.accountsReceivable;
          existing.totalBilled += match.parsed.totalBilled;
          existing.totalPaid += match.parsed.totalPaid;
          existing.totalWipDisbursement += match.parsed.wipDisbursement;
          existing.totalArDisbursement += match.parsed.arDisbursement;
          existing.totalPaidDisbursement += match.parsed.paidDisbursement;
          // Keep highest confidence
          if (match.confidence === 'high' || (existing.confidence !== 'high' && match.confidence === 'medium')) {
            existing.confidence = match.confidence;
          }
          if (match.usedSavedMapping) {
            existing.usedSavedMapping = true;
          }
        } else {
          matterAggregates.set(match.matterId, {
            rowIndices: [match.parsed.rowIndex],
            clientNames: match.parsed.clientName ? [match.parsed.clientName] : [],
            totalWip: match.parsed.wip,
            totalWipWriteOff: match.parsed.wipWriteOff,
            totalAr: match.parsed.accountsReceivable,
            totalBilled: match.parsed.totalBilled,
            totalPaid: match.parsed.totalPaid,
            totalWipDisbursement: match.parsed.wipDisbursement,
            totalArDisbursement: match.parsed.arDisbursement,
            totalPaidDisbursement: match.parsed.paidDisbursement,
            matter,
            confidence: match.confidence,
            usedSavedMapping: match.usedSavedMapping,
            firstRow: match.parsed,
          });
        }
        processedRowIndices.add(match.parsed.rowIndex);
      }
    }

    // Build result arrays
    const matchedData: MatchedData[] = [];
    const lowConfidenceData: MatchedData[] = [];
    const unmatchedData: MatchedData[] = [];

    // Add aggregated multi-client matters
    for (const [matterId, agg] of matterAggregates) {
      const needsConfirmation = !agg.usedSavedMapping && agg.confidence !== 'high';
      
      const result: MatchedData = {
        rowIndex: agg.firstRow.rowIndex,
        rowIndices: agg.rowIndices.length > 1 ? agg.rowIndices : undefined,
        matterNumber: agg.firstRow.matterNumber,
        matterName: agg.firstRow.matterName,
        clientName: agg.clientNames.join(', '),
        clientNames: agg.clientNames.length > 1 ? agg.clientNames : undefined,
        matchedMatterId: matterId,
        matchedMatterName: agg.matter.matter_name,
        matchConfidence: agg.confidence,
        needsConfirmation,
        isMultiClientAggregate: agg.rowIndices.length > 1,
        currency: agg.matter.currency || 'GBP',
        wip: {
          value: agg.totalWip,
          current: agg.matter.current_wip,
          changed: !isWithinTolerance(agg.totalWip, agg.matter.current_wip),
        },
        wipWriteOff: {
          value: agg.totalWipWriteOff,
          current: agg.matter.current_wip_write_off || 0,
          changed: !isWithinTolerance(agg.totalWipWriteOff, agg.matter.current_wip_write_off || 0),
        },
        accountsReceivable: {
          value: agg.totalAr,
          current: agg.matter.current_ar,
          changed: !isWithinTolerance(agg.totalAr, agg.matter.current_ar),
        },
        totalBilled: {
          value: agg.totalBilled,
          current: agg.matter.current_billed,
          changed: !isWithinTolerance(agg.totalBilled, agg.matter.current_billed),
        },
        totalPaid: {
          value: agg.totalPaid,
          current: agg.matter.current_paid,
          changed: !isWithinTolerance(agg.totalPaid, agg.matter.current_paid),
        },
        wipDisbursement: agg.totalWipDisbursement,
        arDisbursement: agg.totalArDisbursement,
        paidDisbursement: agg.totalPaidDisbursement,
      };

      if (needsConfirmation) {
        lowConfidenceData.push(result);
      } else {
        matchedData.push(result);
      }
    }

    // Add non-multi-client matched rows
    for (const match of rowMatches) {
      if (processedRowIndices.has(match.parsed.rowIndex)) continue;
      if (!match.matterId || match.confidence === 'none') continue;

      const matter = match.matter!;
      const needsConfirmation = !match.usedSavedMapping && match.confidence !== 'high';

      const result: MatchedData = {
        rowIndex: match.parsed.rowIndex,
        matterNumber: match.parsed.matterNumber,
        matterName: match.parsed.matterName,
        clientName: match.parsed.clientName,
        matchedMatterId: match.matterId,
        matchedMatterName: match.matterName,
        matchConfidence: match.confidence,
        needsConfirmation,
        currency: matter.currency || 'GBP',
        wip: {
          value: match.parsed.wip,
          current: matter.current_wip,
          changed: !isWithinTolerance(match.parsed.wip, matter.current_wip),
        },
        wipWriteOff: {
          value: match.parsed.wipWriteOff,
          current: matter.current_wip_write_off || 0,
          changed: !isWithinTolerance(match.parsed.wipWriteOff, matter.current_wip_write_off || 0),
        },
        accountsReceivable: {
          value: match.parsed.accountsReceivable,
          current: matter.current_ar,
          changed: !isWithinTolerance(match.parsed.accountsReceivable, matter.current_ar),
        },
        totalBilled: {
          value: match.parsed.totalBilled,
          current: matter.current_billed,
          changed: !isWithinTolerance(match.parsed.totalBilled, matter.current_billed),
        },
        totalPaid: {
          value: match.parsed.totalPaid,
          current: matter.current_paid,
          changed: !isWithinTolerance(match.parsed.totalPaid, matter.current_paid),
        },
        wipDisbursement: match.parsed.wipDisbursement,
        arDisbursement: match.parsed.arDisbursement,
        paidDisbursement: match.parsed.paidDisbursement,
      };

      if (needsConfirmation) {
        lowConfidenceData.push(result);
      } else {
        matchedData.push(result);
      }
    }

    // Add unmatched rows
    for (const match of unmatchedRows) {
      unmatchedData.push({
        rowIndex: match.parsed.rowIndex,
        matterNumber: match.parsed.matterNumber,
        matterName: match.parsed.matterName,
        clientName: match.parsed.clientName,
        matchedMatterId: null,
        matchedMatterName: null,
        matchConfidence: 'none',
        needsConfirmation: false,
        currency: 'GBP',
        wip: {
          value: match.parsed.wip,
          current: 0,
          changed: true,
        },
        wipWriteOff: {
          value: match.parsed.wipWriteOff,
          current: 0,
          changed: match.parsed.wipWriteOff > 0,
        },
        accountsReceivable: {
          value: match.parsed.accountsReceivable,
          current: 0,
          changed: true,
        },
        totalBilled: {
          value: match.parsed.totalBilled,
          current: 0,
          changed: true,
        },
        totalPaid: {
          value: match.parsed.totalPaid,
          current: 0,
          changed: true,
        },
        wipDisbursement: match.parsed.wipDisbursement,
        arDisbursement: match.parsed.arDisbursement,
        paidDisbursement: match.parsed.paidDisbursement,
      });
    }

    console.log(`Matched: ${matchedData.length}, Low confidence: ${lowConfidenceData.length}, Unmatched: ${unmatchedData.length}`);
    console.log(`Multi-client aggregations: ${[...matterAggregates.values()].filter(a => a.rowIndices.length > 1).length}`);
    console.log(`Potential aggregations detected: ${potentialAggregations.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        matchedData,
        lowConfidenceData,
        unmatchedData,
        potentialAggregations,
        summary: {
          totalRows: rows.length,
          matched: matchedData.length,
          lowConfidence: lowConfidenceData.length,
          unmatched: unmatchedData.length,
          changedCount: [...matchedData, ...lowConfidenceData].filter(d => 
            d.wip.changed || d.accountsReceivable.changed || 
            d.totalBilled.changed || d.totalPaid.changed
          ).length,
          multiClientAggregations: [...matterAggregates.values()].filter(a => a.rowIndices.length > 1).length,
          potentialAggregations: potentialAggregations.length,
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
