/**
 * Get the display name for a client.
 * Returns display_name if set, otherwise falls back to the full name.
 */
export function getClientDisplayName(client: { name: string; display_name?: string | null } | null | undefined): string {
  if (!client) return 'Unknown Client';
  return client.display_name?.trim() || client.name;
}

/**
 * Get the display name from a matter's client relationship.
 * This handles the nested client object from Supabase joins.
 */
export function getMatterClientDisplayName(matter: { clients?: { name: string; display_name?: string | null } | null } | null | undefined): string {
  if (!matter?.clients) return 'Unknown Client';
  return getClientDisplayName(matter.clients);
}
