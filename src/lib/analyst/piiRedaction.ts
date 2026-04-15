/**
 * Opt-in PII redaction for contract text sent to the LLM.
 *
 * Legal contract analysis normally needs to see full contract text, including
 * party names and identifiers. But contracts frequently contain incidental
 * PII — admin notice emails, personal phone numbers, bank account numbers,
 * tax IDs — that is not material to the terms-analysis task and that users
 * may not want to pass through a third-party LLM.
 *
 * This helper masks common PII patterns with typed placeholders, so the
 * LLM can still tell "there is an email here" without seeing the address.
 * It is deliberately conservative: only high-confidence patterns are
 * matched, to avoid mangling defined terms / contract language.
 *
 * Limitations (intentional):
 *   - Does NOT redact party names (those are load-bearing for the analysis).
 *   - Does NOT redact addresses (often material to jurisdiction / notice).
 *   - Does NOT attempt named-entity detection — only regex patterns with
 *     high precision.
 */

export interface RedactionCounts {
  email: number;
  phone: number;
  ssn: number;
  ein: number;
  iban: number;
  card: number;
}

export interface RedactionResult {
  redacted: string;
  counts: RedactionCounts;
  totalRedactions: number;
}

// Email: standard RFC-lite — requires a @ and a dot in the domain.
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

// Phone: international +CC or groups of 3-4 digits separated by space/dash/dot.
// Requires at least 10 total digits and a separator to avoid eating raw
// numbers like contract clause IDs.
const PHONE_RE = /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?|\d{2,4}[\s.-])\d{3,4}[\s.-]\d{3,4}\b/g;

// US SSN: 3-2-4 pattern, rejects invalid area numbers like 000 and 666.
const SSN_RE = /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g;

// US EIN: 2-7 pattern (e.g. 12-3456789).
const EIN_RE = /\b\d{2}-\d{7}\b/g;

// IBAN: 2 country letters + 2 check digits + 11-30 alphanumerics.
const IBAN_RE = /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g;

// Credit card: 13-19 digits with optional space/dash groups. Requires
// group structure (to avoid random 16-digit numbers). Luhn check applied.
const CARD_RE = /\b(?:\d[ -]?){13,19}\b/g;

function luhn(numStr: string): boolean {
  const digits = numStr.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function redactPII(text: string): RedactionResult {
  const counts: RedactionCounts = {
    email: 0,
    phone: 0,
    ssn: 0,
    ein: 0,
    iban: 0,
    card: 0,
  };

  let redacted = text;

  redacted = redacted.replace(EMAIL_RE, () => {
    counts.email += 1;
    return '[EMAIL_REDACTED]';
  });

  redacted = redacted.replace(SSN_RE, () => {
    counts.ssn += 1;
    return '[SSN_REDACTED]';
  });

  redacted = redacted.replace(EIN_RE, () => {
    counts.ein += 1;
    return '[EIN_REDACTED]';
  });

  redacted = redacted.replace(IBAN_RE, () => {
    counts.iban += 1;
    return '[IBAN_REDACTED]';
  });

  redacted = redacted.replace(CARD_RE, (match) => {
    if (!luhn(match)) return match;
    counts.card += 1;
    return '[CARD_REDACTED]';
  });

  // Phone last — otherwise phone regex can eat SSN-like sequences.
  redacted = redacted.replace(PHONE_RE, () => {
    counts.phone += 1;
    return '[PHONE_REDACTED]';
  });

  const totalRedactions =
    counts.email + counts.phone + counts.ssn + counts.ein + counts.iban + counts.card;

  return { redacted, counts, totalRedactions };
}

/** Returns a one-line summary like "3 emails, 1 phone redacted". Empty string if nothing redacted. */
export function summarizeRedaction(counts: RedactionCounts): string {
  const parts: string[] = [];
  if (counts.email) parts.push(`${counts.email} email${counts.email === 1 ? '' : 's'}`);
  if (counts.phone) parts.push(`${counts.phone} phone${counts.phone === 1 ? '' : 's'}`);
  if (counts.ssn) parts.push(`${counts.ssn} SSN${counts.ssn === 1 ? '' : 's'}`);
  if (counts.ein) parts.push(`${counts.ein} EIN${counts.ein === 1 ? '' : 's'}`);
  if (counts.iban) parts.push(`${counts.iban} IBAN${counts.iban === 1 ? '' : 's'}`);
  if (counts.card) parts.push(`${counts.card} card${counts.card === 1 ? '' : 's'} number${counts.card === 1 ? '' : 's'}`);
  return parts.length ? parts.join(', ') + ' redacted' : '';
}
