import { useState, useEffect, useRef } from "react";
import { CheckSquare, X, Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface QuickTask {
  id: string;
  title: string;
  is_completed: boolean;
  created_at: string;
}

const STORAGE_KEY = 'todo-button-position';

export function QuickToDoButton() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [tasks, setTasks] = useState<QuickTask[]>([]);
  const [newTask, setNewTask] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  // Load saved position on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const maxX = window.innerWidth - 56;
        const maxY = window.innerHeight - 56;
        setPosition({
          x: Math.min(Math.max(0, parsed.x), maxX),
          y: Math.min(Math.max(0, parsed.y), maxY),
        });
      } catch {
        // Invalid saved position, use default
      }
    }
  }, []);

  // Save position when it changes
  useEffect(() => {
    if (position) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
    }
  }, [position]);

  // Load tasks
  useEffect(() => {
    if (user) {
      fetchTasks();
    }
  }, [user]);

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from('quick_tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tasks:', error);
      return;
    }

    setTasks(data || []);
  };

  const addTask = async () => {
    if (!newTask.trim() || !user) return;

    setIsLoading(true);
    const { error } = await supabase
      .from('quick_tasks')
      .insert({
        title: newTask.trim(),
        user_id: user.id,
      });

    if (error) {
      toast.error('Failed to add task');
      console.error('Error adding task:', error);
    } else {
      setNewTask("");
      fetchTasks();
    }
    setIsLoading(false);
  };

  const toggleTask = async (task: QuickTask) => {
    const { error } = await supabase
      .from('quick_tasks')
      .update({
        is_completed: !task.is_completed,
        completed_at: !task.is_completed ? new Date().toISOString() : null,
      })
      .eq('id', task.id);

    if (error) {
      toast.error('Failed to update task');
      console.error('Error updating task:', error);
    } else {
      fetchTasks();
    }
  };

  const deleteTask = async (taskId: string) => {
    const { error } = await supabase
      .from('quick_tasks')
      .delete()
      .eq('id', taskId);

    if (error) {
      toast.error('Failed to delete task');
      console.error('Error deleting task:', error);
    } else {
      fetchTasks();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTask();
    }
  };

  // Handle pointer events for dragging
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isOpen) return;

    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: position?.x ?? 24,
      startPosY: position?.y ?? (window.innerHeight - rect.height - 24),
    };

    setIsDragging(false);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;

    const deltaX = e.clientX - dragRef.current.startX;
    const deltaY = e.clientY - dragRef.current.startY;

    if (!isDragging && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
      setIsDragging(true);
    }

    if (isDragging || Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      const buttonSize = 56;
      const newX = Math.min(Math.max(0, dragRef.current.startPosX + deltaX), window.innerWidth - buttonSize);
      const newY = Math.min(Math.max(0, dragRef.current.startPosY + deltaY), window.innerHeight - buttonSize);
      setPosition({ x: newX, y: newY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const wasDragging = isDragging;
    dragRef.current = null;
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    if (!wasDragging) {
      setIsOpen(!isOpen);
    }
  };

  const getButtonStyle = (): React.CSSProperties => {
    if (position) {
      return {
        position: 'fixed',
        left: position.x,
        top: position.y,
        right: 'auto',
        bottom: 'auto',
      };
    }
    return {
      position: 'fixed',
      left: 24,
      bottom: 24,
    };
  };

  const getPanelStyle = (): React.CSSProperties => {
    const panelWidth = Math.min(320, window.innerWidth - 24);
    const panelHeight = 400;
    const margin = 12;

    if (position) {
      let left: number;
      let top: number;

      if (position.y > window.innerHeight / 2) {
        top = Math.max(margin, position.y - panelHeight - 8);
      } else {
        top = position.y + 64;
      }

      left = position.x - panelWidth / 2 + 28;
      left = Math.max(margin, Math.min(left, window.innerWidth - panelWidth - margin));
      top = Math.max(margin, Math.min(top, window.innerHeight - panelHeight - margin));

      return {
        position: 'fixed',
        left,
        top,
        right: 'auto',
        bottom: 'auto',
      };
    }

    return {
      position: 'fixed',
      left: 24,
      bottom: 96,
    };
  };

  const getOpenButtonStyle = (): React.CSSProperties => {
    const panelStyle = getPanelStyle();
    const panelWidth = Math.min(320, window.innerWidth - 24);
    const panelHeight = 400;
    const buttonSize = 56;

    const panelLeft = panelStyle.left as number ?? 24;
    const panelTop = panelStyle.top as number ?? 0;

    return {
      position: 'fixed',
      left: panelLeft + panelWidth / 2 - buttonSize / 2,
      top: panelTop + panelHeight + 8,
      right: 'auto',
      bottom: 'auto',
    };
  };

  const incompleteTasks = tasks.filter(t => !t.is_completed);
  const completedTasks = tasks.filter(t => t.is_completed);

  return (
    <>
      {/* Floating Draggable Button */}
      <div
        ref={buttonRef}
        className="z-50"
        style={isOpen ? getOpenButtonStyle() : getButtonStyle()}
      >
        <button
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={cn(
            "relative h-14 w-14 rounded-full shadow-xl transition-all duration-300 touch-none select-none",
            "bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600",
            "hover:from-emerald-400 hover:via-teal-400 hover:to-cyan-500",
            "hover:shadow-2xl hover:shadow-teal-500/30",
            !isDragging && "hover:scale-110",
            "flex items-center justify-center text-white",
            "ring-2 ring-white/20 ring-offset-2 ring-offset-background",
            isOpen && "rotate-90",
            isDragging && "cursor-grabbing scale-110 shadow-2xl shadow-teal-500/40",
            !isDragging && !isOpen && "cursor-grab"
          )}
        >
          {isOpen ? <X className="h-6 w-6" /> : <CheckSquare className="h-6 w-6" />}
          {/* Badge for incomplete tasks */}
          {!isOpen && incompleteTasks.length > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
              {incompleteTasks.length > 9 ? '9+' : incompleteTasks.length}
            </span>
          )}
        </button>
      </div>

      {/* Task Panel */}
      {isOpen && (
        <div
          className="z-50 w-80 max-w-[calc(100vw-3rem)] rounded-xl border-0 shadow-2xl shadow-teal-500/20 overflow-hidden animate-scale-in bg-background"
          style={getPanelStyle()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                <CheckSquare className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white">Quick To-Do</h3>
                <p className="text-xs text-white/80">
                  {incompleteTasks.length} task{incompleteTasks.length !== 1 ? 's' : ''} pending
                </p>
              </div>
            </div>
          </div>

          {/* Add Task Input */}
          <div className="p-3 border-b">
            <div className="flex gap-2">
              <Input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add a quick task..."
                className="flex-1"
                disabled={isLoading}
              />
              <Button
                size="icon"
                onClick={addTask}
                disabled={!newTask.trim() || isLoading}
                className="bg-teal-500 hover:bg-teal-600"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Task List */}
          <ScrollArea className="h-[280px]">
            <div className="p-3 space-y-2">
              {incompleteTasks.length === 0 && completedTasks.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8">
                  No tasks yet. Add one above!
                </p>
              )}

              {incompleteTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 group"
                >
                  <Checkbox
                    checked={task.is_completed}
                    onCheckedChange={() => toggleTask(task)}
                  />
                  <span className="flex-1 text-sm">{task.title}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => deleteTask(task.id)}
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
              ))}

              {completedTasks.length > 0 && (
                <>
                  <div className="text-xs text-muted-foreground pt-2 pb-1 font-medium">
                    Completed ({completedTasks.length})
                  </div>
                  {completedTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 group"
                    >
                      <Checkbox
                        checked={task.is_completed}
                        onCheckedChange={() => toggleTask(task)}
                      />
                      <span className="flex-1 text-sm text-muted-foreground line-through">
                        {task.title}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => deleteTask(task.id)}
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </>
  );
}
