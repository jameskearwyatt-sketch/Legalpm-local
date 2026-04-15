import { ShieldCheck, Info } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * Opt-in toggle for PII redaction before the contract text is sent to
 * the LLM. Used in all 5 analyst upload flows. See
 * `src/lib/analyst/piiRedaction.ts` for what is masked.
 *
 * The toggle is intentionally OFF by default — contract analysis usually
 * benefits from seeing incidental contact info (notice provisions, etc.).
 * Users who handle particularly sensitive contracts can flip it on.
 */
interface Props {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function PIIRedactionToggle({ checked, onCheckedChange, disabled }: Props) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg border bg-muted/30">
      <Checkbox
        id="pii-redaction"
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        disabled={disabled}
        className="mt-0.5"
      />
      <div className="flex-1 space-y-1">
        <Label htmlFor="pii-redaction" className="text-sm font-medium flex items-center gap-2 cursor-pointer">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Redact PII before sending to the AI
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                Masks emails, phone numbers, SSN/EIN, IBAN, and card numbers in the contract text before it is sent to the AI. Party names, addresses, and contract terms are not affected. The original document is unchanged.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </Label>
        <p className="text-xs text-muted-foreground">
          Emails, phone numbers, and tax / account identifiers are replaced with typed placeholders before the contract text leaves your browser.
        </p>
      </div>
    </div>
  );
}
