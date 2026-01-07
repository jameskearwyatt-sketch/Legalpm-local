import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FileText, ChevronDown, Trash2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { type GrowthProjectEntry } from '@/lib/hooks/useGrowthProjects';
import { cn } from '@/lib/utils';

interface EntryCardProps {
  entry: GrowthProjectEntry;
  onDelete: () => void;
}

export const EntryCard = ({ entry, onDelete }: EntryCardProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const getPreview = (content: string | null): string => {
    if (!content) return '';
    const firstLine = content.split('\n')[0];
    return firstLine.length > 80 ? firstLine.substring(0, 80) + '...' : firstLine;
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg overflow-hidden hover:border-primary/30 transition-colors">
        <CollapsibleTrigger asChild>
          <button className="w-full text-left p-3 flex items-center gap-3 hover:bg-accent/30 transition-colors">
            <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">
                {entry.title || 'Untitled Entry'}
              </p>
              {!isOpen && entry.content && (
                <p className="text-xs text-muted-foreground truncate">
                  {getPreview(entry.content)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="text-xs hidden sm:flex">
                <Calendar className="h-3 w-3 mr-1" />
                {format(new Date(entry.created_at), 'MMM d')}
              </Badge>
              <ChevronDown className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                isOpen && "rotate-180"
              )} />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0 space-y-3 border-t">
            {entry.content && (
              <div className="pt-3">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {entry.content}
                </p>
              </div>
            )}
            {entry.file_name && (
              <Badge variant="secondary" className="text-xs">
                <FileText className="h-3 w-3 mr-1" />
                {entry.file_name}
              </Badge>
            )}
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                Added {format(new Date(entry.created_at), 'PPp')}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
