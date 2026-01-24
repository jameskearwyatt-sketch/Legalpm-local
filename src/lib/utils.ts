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
