import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converts a name stored as "Surname, FirstName" to display format "FirstName Surname".
 * If the name doesn't contain a comma, returns it as-is (already in correct format).
 */
export function formatDisplayName(fullName: string): string {
  if (!fullName) return '';
  
  // If no comma, already in "FirstName Surname" format
  if (!fullName.includes(',')) {
    return fullName.trim();
  }
  
  // Convert "Surname, FirstName" to "FirstName Surname"
  const parts = fullName.split(',').map(p => p.trim());
  if (parts.length === 2 && parts[0] && parts[1]) {
    return `${parts[1]} ${parts[0]}`;
  }
  
  // Fallback: return as-is
  return fullName.trim();
}

/**
 * Extracts the surname from a full name for consistent sorting.
 * Handles both legacy "Surname, FirstName" and modern "FirstName Surname" formats.
 * Returns the surname in lowercase for case-insensitive sorting.
 */
export function extractSurnameForSort(fullName: string): string {
  if (!fullName) return '';
  
  const trimmed = fullName.trim();
  
  // Legacy format: "Surname, FirstName" - surname is before the comma
  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map(p => p.trim());
    if (parts.length >= 1 && parts[0]) {
      return parts[0].toLowerCase();
    }
  }
  
  // Modern format: "FirstName Surname" - surname is the last word
  // Handle multi-part names like "Mary Jane Watson" → "Watson"
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words[words.length - 1].toLowerCase();
  }
  
  // Single name (no space) - use the whole name
  return trimmed.toLowerCase();
}
