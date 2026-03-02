import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, CheckCircle2, XCircle, Plus, Minus, Minus as Unchanged } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ItemChange {
  id: string;
  baseItemId?: string;
  action: "modified" | "removed" | "added" | "unchanged";
  originalWorkItem?: string;
  originalDetail?: string;
  newWorkItem?: string;
  newDetail?: string;
  newCategory?: string;
  newPhaseId?: string;
  rationale: string;
  fee_amount?: number;
  fee_lower?: number;
  fee_upper?: number;
  provider?: string;
  // User decisions
  accepted: boolean;
  comment: string;
}

export interface PhaseChange {
  id: string;
  basePhaseId?: string;
  action: "renamed" | "removed" | "added" | "unchanged";
  originalName?: string;
  newName?: string;
  rationale: string;
  accepted: boolean;
  comment: string;
}

export interface ScopeChange {
  id: string;
  type: "modified" | "removed" | "added";
  description: string;
  rationale: string;
  accepted: boolean;
  comment: string;
}

interface StepReviewChangesProps {
  phaseChanges: PhaseChange[];
  itemChanges: ItemChange[];
  scopeChanges: ScopeChange[];
  generalComment: string;
  onPhaseToggle: (id: string) => void;
  onPhaseComment: (id: string, comment: string) => void;
  onItemToggle: (id: string) => void;
  onItemComment: (id: string, comment: string) => void;
  onScopeToggle: (id: string) => void;
  onScopeComment: (id: string, comment: string) => void;
  onGeneralCommentChange: (comment: string) => void;
  onBack: () => void;
  onRefine: () => void;
  isRefining: boolean;
}

const actionBadgeVariant: Record<string, string> = {
  modified: "bg-amber-100 text-amber-800 border-amber-300",
  renamed: "bg-amber-100 text-amber-800 border-amber-300",
  removed: "bg-red-100 text-red-800 border-red-300",
  added: "bg-green-100 text-green-800 border-green-300",
  unchanged: "bg-muted text-muted-foreground",
};

function ChangeRow({
  action,
  original,
  updated,
  rationale,
  accepted,
  comment,
  onToggle,
  onComment,
}: {
  action: string;
  original?: string;
  updated?: string;
  rationale: string;
  accepted: boolean;
  comment: string;
  onToggle: () => void;
  onComment: (c: string) => void;
}) {
  const [showComment, setShowComment] = useState(false);

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn("text-xs capitalize", actionBadgeVariant[action])}>
              {action}
            </Badge>
          </div>
          {action === "modified" || action === "renamed" ? (
            <div className="text-sm space-y-1">
              <div className="line-through text-muted-foreground">{original}</div>
              <div className="font-medium">{updated}</div>
            </div>
          ) : action === "removed" ? (
            <div className="text-sm line-through text-muted-foreground">{original}</div>
          ) : action === "added" ? (
            <div className="text-sm font-medium">{updated}</div>
          ) : (
            <div className="text-sm">{original}</div>
          )}
          <p className="text-xs text-muted-foreground italic">{rationale}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => setShowComment(!showComment)}
          >
            Comment
          </Button>
          {action !== "unchanged" && (
            <div className="flex items-center gap-1.5">
              <Label htmlFor="" className="text-xs text-muted-foreground">
                {accepted ? "Accept" : "Reject"}
              </Label>
              <Switch checked={accepted} onCheckedChange={onToggle} />
            </div>
          )}
        </div>
      </div>
      {showComment && (
        <Input
          value={comment}
          onChange={e => onComment(e.target.value)}
          placeholder="Add a comment for the AI…"
          className="text-sm"
        />
      )}
    </div>
  );
}

export function StepReviewChanges({
  phaseChanges,
  itemChanges,
  scopeChanges,
  generalComment,
  onPhaseToggle,
  onPhaseComment,
  onItemToggle,
  onItemComment,
  onScopeToggle,
  onScopeComment,
  onGeneralCommentChange,
  onBack,
  onRefine,
  isRefining,
}: StepReviewChangesProps) {
  const modifiedCount = itemChanges.filter(c => c.action === "modified").length;
  const addedCount = itemChanges.filter(c => c.action === "added").length;
  const removedCount = itemChanges.filter(c => c.action === "removed").length;
  const unchangedCount = itemChanges.filter(c => c.action === "unchanged").length;

  // Group items by phase
  const phases = [...new Set(itemChanges.map(c => c.newPhaseId || c.baseItemId || "unassigned"))];

  return (
    <div className="space-y-6">
      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className={actionBadgeVariant.modified}>{modifiedCount} Modified</Badge>
        <Badge variant="outline" className={actionBadgeVariant.added}>{addedCount} Added</Badge>
        <Badge variant="outline" className={actionBadgeVariant.removed}>{removedCount} Removed</Badge>
        <Badge variant="outline" className={actionBadgeVariant.unchanged}>{unchangedCount} Unchanged</Badge>
      </div>

      {/* Phase-level changes */}
      {phaseChanges.filter(p => p.action !== "unchanged").length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Phase Changes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {phaseChanges.filter(p => p.action !== "unchanged").map(pc => (
              <ChangeRow
                key={pc.id}
                action={pc.action}
                original={pc.originalName}
                updated={pc.newName}
                rationale={pc.rationale}
                accepted={pc.accepted}
                comment={pc.comment}
                onToggle={() => onPhaseToggle(pc.id)}
                onComment={c => onPhaseComment(pc.id, c)}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Item-level changes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Work Item Changes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {itemChanges.map(ic => (
            <ChangeRow
              key={ic.id}
              action={ic.action}
              original={ic.originalWorkItem}
              updated={ic.newWorkItem}
              rationale={ic.rationale}
              accepted={ic.accepted}
              comment={ic.comment}
              onToggle={() => onItemToggle(ic.id)}
              onComment={c => onItemComment(ic.id, c)}
            />
          ))}
        </CardContent>
      </Card>

      {/* Scope assumption changes */}
      {scopeChanges.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Scope Assumption Changes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {scopeChanges.map(sc => (
              <ChangeRow
                key={sc.id}
                action={sc.type}
                updated={sc.description}
                rationale={sc.rationale}
                accepted={sc.accepted}
                comment={sc.comment}
                onToggle={() => onScopeToggle(sc.id)}
                onComment={c => onScopeComment(sc.id, c)}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* General comment */}
      <div className="space-y-2">
        <Label>General feedback for the AI (optional)</Label>
        <Textarea
          value={generalComment}
          onChange={e => onGeneralCommentChange(e.target.value)}
          placeholder="Any overall guidance for the refinement pass…"
          className="min-h-[80px]"
        />
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isRefining}>
          <ArrowLeft className="h-4 w-4 mr-2" />Back
        </Button>
        <Button onClick={onRefine} disabled={isRefining}>
          {isRefining ? "Refining…" : "Refine and Create"}
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
