import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useContactHistory, getFieldLabel } from "@/lib/hooks/useContactHistory";
import { format } from "date-fns";
import { History, ArrowRight, Upload, Pencil, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContactHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName: string;
}

const sourceIcons: Record<string, React.ReactNode> = {
  manual: <Pencil className="h-3 w-3" />,
  import: <Upload className="h-3 w-3" />,
};

const sourceColors: Record<string, string> = {
  manual: "bg-secondary text-secondary-foreground",
  import: "bg-accent text-accent-foreground",
};

export function ContactHistoryDialog({
  open,
  onOpenChange,
  contactId,
  contactName,
}: ContactHistoryDialogProps) {
  const { data: history = [], isLoading } = useContactHistory(contactId);

  // Group history by date
  const groupedHistory = history.reduce((acc, entry) => {
    const date = format(new Date(entry.changed_at), "d MMM yyyy");
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(entry);
    return acc;
  }, {} as Record<string, typeof history>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            History: {contactName}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No history recorded yet. Changes to this contact will appear here.
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedHistory).map(([date, entries]) => (
                <div key={date} className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground sticky top-0 bg-background py-1">
                    {date}
                  </h4>
                  <div className="space-y-2 pl-2 border-l-2 border-border">
                    {entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="relative pl-4 pb-3 last:pb-0"
                      >
                        {/* Timeline dot */}
                        <div className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-border" />
                        
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-xs gap-1",
                                sourceColors[entry.change_source]
                              )}
                            >
                              {sourceIcons[entry.change_source]}
                              {entry.change_source}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(entry.changed_at), "HH:mm")}
                            </span>
                          </div>

                          <div className="text-sm">
                            <span className="font-medium">
                              {getFieldLabel(entry.field_name)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground line-through max-w-[150px] truncate">
                              {entry.old_value || "(empty)"}
                            </span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <span className="text-foreground max-w-[150px] truncate">
                              {entry.new_value || "(empty)"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
