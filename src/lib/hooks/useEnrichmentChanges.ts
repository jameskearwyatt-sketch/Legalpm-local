import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface EnrichmentChange {
  contactId: string;
  fieldName: 'email' | 'company';
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
}

export interface ContactEnrichmentChanges {
  [contactId: string]: {
    email?: { old: string | null; new: string | null; changedAt: string };
    company?: { old: string | null; new: string | null; changedAt: string };
  };
}

/**
 * Fetches recent enrichment changes (email and company only) for a set of contacts
 * Used to show diff indicators after import+enrich
 */
export function useEnrichmentChanges(contactIds: string[] | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["enrichment-changes", contactIds?.join(",") || "none"],
    queryFn: async (): Promise<ContactEnrichmentChanges> => {
      if (!user || !contactIds || contactIds.length === 0) return {};

      // Fetch enrichment history for email and company fields only
      const { data, error } = await supabase
        .from("distribution_contact_history")
        .select("*")
        .eq("user_id", user.id)
        .eq("change_source", "enrichment")
        .in("contact_id", contactIds)
        .in("field_name", ["email", "company"])
        .order("changed_at", { ascending: false });

      if (error) throw error;

      // Group by contact ID, keeping only the most recent change per field
      const result: ContactEnrichmentChanges = {};
      
      for (const row of data || []) {
        const contactId = row.contact_id;
        const fieldName = row.field_name as 'email' | 'company';
        
        if (!result[contactId]) {
          result[contactId] = {};
        }
        
        // Only keep the most recent change per field (data is already sorted desc)
        if (!result[contactId][fieldName]) {
          result[contactId][fieldName] = {
            old: row.old_value,
            new: row.new_value,
            changedAt: row.changed_at,
          };
        }
      }

      return result;
    },
    enabled: !!user && !!contactIds && contactIds.length > 0,
    staleTime: 30000, // Cache for 30 seconds
  });
}

/**
 * Normalizes a string for comparison - lowercase, trimmed, and whitespace-collapsed
 */
function normalizeForComparison(value: string | null): string {
  if (!value) return '';
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Checks if there's a substantive change between two values
 * (ignoring case, leading/trailing whitespace, and multiple spaces)
 */
function hasSubstantiveChange(oldVal: string | null, newVal: string | null): boolean {
  const normalizedOld = normalizeForComparison(oldVal);
  const normalizedNew = normalizeForComparison(newVal);
  
  // Both empty = no change
  if (!normalizedOld && !normalizedNew) return false;
  
  // One empty, one not = real change (e.g., null -> "Google")
  if (!normalizedOld || !normalizedNew) return true;
  
  // Compare normalized values
  return normalizedOld !== normalizedNew;
}

/**
 * Returns contacts that have meaningful enrichment changes (email or company)
 * Uses case-insensitive comparison to avoid flagging trivial formatting differences
 */
export function getContactsWithMeaningfulChanges(
  changes: ContactEnrichmentChanges
): Set<string> {
  const result = new Set<string>();
  
  for (const [contactId, fieldChanges] of Object.entries(changes)) {
    // Check for substantive changes (case-insensitive, whitespace-normalized)
    const hasEmailChange = fieldChanges.email && 
      hasSubstantiveChange(fieldChanges.email.old, fieldChanges.email.new);
    const hasCompanyChange = fieldChanges.company && 
      hasSubstantiveChange(fieldChanges.company.old, fieldChanges.company.new);
    
    if (hasEmailChange || hasCompanyChange) {
      result.add(contactId);
    }
  }
  
  return result;
}
