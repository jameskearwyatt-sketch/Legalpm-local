// Local-only mode: all data stored in PGlite (browser-local PostgreSQL).
// The db adapter mimics the Supabase client API so existing hooks work unchanged.
import { db } from '@/lib/db/client';

export const supabase = db;
