import { useState, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Settings2, GripVertical, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  locked?: boolean; // Cannot be hidden or reordered
}

interface SortableColumnItemProps {
  column: ColumnConfig;
  onToggle: (id: string) => void;
}

const SortableColumnItem = forwardRef<HTMLDivElement, SortableColumnItemProps>(
  function SortableColumnItem({ column, onToggle }, _ref) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: column.id, disabled: column.locked });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded-md",
          isDragging && "bg-muted shadow-md z-50",
          column.locked && "opacity-60"
        )}
      >
        <div
          {...attributes}
          {...listeners}
          className={cn(
            "cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-muted",
            column.locked && "cursor-not-allowed opacity-50"
          )}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <Checkbox
          id={`col-${column.id}`}
          checked={column.visible}
          onCheckedChange={() => onToggle(column.id)}
          disabled={column.locked}
        />
        <label
          htmlFor={`col-${column.id}`}
          className={cn(
            "text-sm flex-1 cursor-pointer",
            column.locked && "cursor-not-allowed"
          )}
        >
          {column.label}
          {column.locked && <span className="text-xs text-muted-foreground ml-1">(locked)</span>}
        </label>
      </div>
    );
  }
);

interface ColumnSettingsPopoverProps {
  columns: ColumnConfig[];
  onColumnsChange: (columns: ColumnConfig[]) => void;
  onReset: () => void;
}

export function ColumnSettingsPopover({
  columns,
  onColumnsChange,
  onReset,
}: ColumnSettingsPopoverProps) {
  const [open, setOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleToggle = (id: string) => {
    const updated = columns.map((col) =>
      col.id === id ? { ...col, visible: !col.visible } : col
    );
    onColumnsChange(updated);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = columns.findIndex((col) => col.id === active.id);
      const newIndex = columns.findIndex((col) => col.id === over.id);
      
      // Don't allow moving locked columns or moving past locked columns
      const activeCol = columns[oldIndex];
      const overCol = columns[newIndex];
      
      if (activeCol.locked || overCol.locked) return;
      
      // Find the first non-locked index (locked columns should stay at the beginning)
      const firstNonLockedIndex = columns.findIndex(col => !col.locked);
      if (newIndex < firstNonLockedIndex) return;

      const newColumns = arrayMove(columns, oldIndex, newIndex);
      onColumnsChange(newColumns);
    }
  };

  const visibleCount = columns.filter((c) => c.visible).length;
  const totalCount = columns.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2">
          <Settings2 className="h-4 w-4" />
          Columns
          <span className="text-xs text-muted-foreground">
            ({visibleCount}/{totalCount})
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-64 p-0 bg-background border shadow-lg z-50" 
        align="end"
      >
        <div className="p-2 border-b flex items-center justify-between">
          <span className="text-sm font-medium">Table Columns</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onReset}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
        </div>
        <div className="p-2 max-h-80 overflow-y-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={columns.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {columns.map((column) => (
                <SortableColumnItem
                  key={column.id}
                  column={column}
                  onToggle={handleToggle}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
        <div className="p-2 border-t">
          <p className="text-xs text-muted-foreground">
            Drag to reorder • Click to show/hide
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
