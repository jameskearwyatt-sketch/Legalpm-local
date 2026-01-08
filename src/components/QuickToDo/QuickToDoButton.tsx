import { useState, useEffect, useRef } from "react";
import { CheckSquare, X, Plus, Trash2, Flame, ArrowRight, Clock, User, Pencil, Briefcase, GraduationCap, Lightbulb, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useGrowthProjects, type TaskDeadlineType, getDeadlineLabel, useKnownAssignees } from "@/lib/hooks/useGrowthProjects";

interface QuickTask {
  id: string;
  title: string;
  is_completed: boolean;
  is_urgent: boolean;
  created_at: string;
}

const STORAGE_KEY = 'todo-button-position';

const deadlineOptions: TaskDeadlineType[] = [
  'this_week',
  'next_week',
  'this_month',
  'next_month',
  'in_3_months',
  'in_6_months',
  'no_deadline',
];

export function QuickToDoButton() {
  const { user } = useAuth();
  const { projects } = useGrowthProjects();
  const { assignees } = useKnownAssignees();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [tasks, setTasks] = useState<QuickTask[]>([]);
  const [newTask, setNewTask] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Move to Growth dialog state
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [taskToMove, setTaskToMove] = useState<QuickTask | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedAssignee, setSelectedAssignee] = useState<string>("");
  const [selectedDeadline, setSelectedDeadline] = useState<TaskDeadlineType>("no_deadline");
  const [isMoving, setIsMoving] = useState(false);

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

  const toggleUrgent = async (task: QuickTask) => {
    const { error } = await supabase
      .from('quick_tasks')
      .update({ is_urgent: !task.is_urgent })
      .eq('id', task.id);

    if (error) {
      toast.error('Failed to update task');
      console.error('Error updating task:', error);
    } else {
      fetchTasks();
    }
  };

  const updateTaskTitle = async (taskId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;

    const { error } = await supabase
      .from('quick_tasks')
      .update({ title: trimmed })
      .eq('id', taskId);

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

  const openMoveDialog = (task: QuickTask) => {
    setTaskToMove(task);
    setSelectedProject("");
    setSelectedAssignee("__unassigned__");
    setSelectedDeadline("no_deadline");
    setMoveDialogOpen(true);
  };

  const handleMoveToGrowth = async () => {
    if (!taskToMove || !selectedProject || !user) return;

    setIsMoving(true);
    try {
      // Create the growth task
      const { error: insertError } = await supabase
        .from('growth_tasks')
        .insert({
          title: taskToMove.title,
          project_id: selectedProject,
          user_id: user.id,
          assignee: selectedAssignee === '__unassigned__' ? null : selectedAssignee,
          deadline_type: selectedDeadline,
          deadline_set_at: selectedDeadline !== 'no_deadline' ? new Date().toISOString() : null,
        });

      if (insertError) throw insertError;

      // Delete the quick task
      const { error: deleteError } = await supabase
        .from('quick_tasks')
        .delete()
        .eq('id', taskToMove.id);

      if (deleteError) throw deleteError;

      toast.success('Task moved to Growth project');
      setMoveDialogOpen(false);
      setTaskToMove(null);
      fetchTasks();
    } catch (error) {
      console.error('Error moving task:', error);
      toast.error('Failed to move task');
    } finally {
      setIsMoving(false);
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
    const panelWidth = isExpanded ? Math.min(480, window.innerWidth - 48) : Math.min(320, window.innerWidth - 24);
    const panelHeight = isExpanded ? Math.min(600, window.innerHeight - 120) : 440;
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
        width: panelWidth,
      };
    }

    return {
      position: 'fixed',
      left: 24,
      bottom: 96,
      width: panelWidth,
    };
  };

  const getOpenButtonStyle = (): React.CSSProperties => {
    const panelStyle = getPanelStyle();
    const panelWidth = isExpanded ? Math.min(480, window.innerWidth - 48) : Math.min(320, window.innerWidth - 24);
    const panelHeight = isExpanded ? Math.min(600, window.innerHeight - 120) : 440;
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

  // Split tasks into categories
  const urgentTasks = tasks.filter(t => !t.is_completed && t.is_urgent);
  const normalTasks = tasks.filter(t => !t.is_completed && !t.is_urgent);
  const completedTasks = tasks.filter(t => t.is_completed);
  const incompleteTasks = tasks.filter(t => !t.is_completed);

  // Active growth projects for the move dialog
  const activeProjects = projects?.filter(p => p.status === 'active') || [];

  const TaskRow = ({ task, isUrgentSection }: { task: QuickTask; isUrgentSection?: boolean }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedTitle, setEditedTitle] = useState(task.title);
    const editInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (isEditing) {
        setEditedTitle(task.title);
        setTimeout(() => {
          editInputRef.current?.focus();
          editInputRef.current?.select();
        }, 0);
      }
    }, [isEditing, task.title]);

    const handleSave = () => {
      if (editedTitle.trim() && editedTitle.trim() !== task.title) {
        updateTaskTitle(task.id, editedTitle);
      }
      setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        setEditedTitle(task.title);
        setIsEditing(false);
      }
    };

    return (
      <div
        className={cn(
          "flex items-center gap-2 p-2 rounded-lg group",
          isUrgentSection ? "bg-red-500/10 border border-red-500/20" : "bg-muted/50"
        )}
      >
        <Checkbox
          checked={task.is_completed}
          onCheckedChange={() => toggleTask(task)}
        />
        {isEditing ? (
          <Input
            ref={editInputRef}
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="flex-1 h-7 text-sm"
          />
        ) : (
          <span 
            className={cn(
              "flex-1 text-sm cursor-pointer hover:bg-background/50 rounded px-1 -mx-1",
              isUrgentSection && "text-red-600 dark:text-red-400 font-medium"
            )}
            onClick={() => setIsEditing(true)}
            title="Click to edit"
          >
            {task.title}
          </span>
        )}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => toggleUrgent(task)}
            title={task.is_urgent ? "Remove from urgent" : "Mark as urgent"}
          >
            <Flame className={cn("h-3 w-3", task.is_urgent ? "text-red-500" : "text-muted-foreground")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => openMoveDialog(task)}
            title="Move to Growth project"
          >
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => deleteTask(task.id)}
          >
            <Trash2 className="h-3 w-3 text-muted-foreground" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Move to Growth Dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move to Growth Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Task</label>
              <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                {taskToMove?.title}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Growth Project *</label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project..." />
                </SelectTrigger>
                <SelectContent>
                  {/* Business Development */}
                  {activeProjects.filter(p => p.project_type === 'business_development').length > 0 && (
                    <div className="px-2 py-1.5 text-xs font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-1.5 border-b mb-1">
                      <Briefcase className="h-3 w-3" />
                      Business Development
                    </div>
                  )}
                  {activeProjects.filter(p => p.project_type === 'business_development').map((project) => (
                    <SelectItem key={project.id} value={project.id} className="pl-6">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-orange-500" />
                        {project.name}
                      </span>
                    </SelectItem>
                  ))}
                  
                  {/* Professional Development */}
                  {activeProjects.filter(p => p.project_type === 'professional_development').length > 0 && (
                    <div className="px-2 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 border-b mb-1 mt-2">
                      <GraduationCap className="h-3 w-3" />
                      Career Development
                    </div>
                  )}
                  {activeProjects.filter(p => p.project_type === 'professional_development').map((project) => (
                    <SelectItem key={project.id} value={project.id} className="pl-6">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        {project.name}
                      </span>
                    </SelectItem>
                  ))}
                  
                  {/* Learning & Development */}
                  {activeProjects.filter(p => p.project_type === 'learning_development').length > 0 && (
                    <div className="px-2 py-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1.5 border-b mb-1 mt-2">
                      <Lightbulb className="h-3 w-3" />
                      Learning & Development
                    </div>
                  )}
                  {activeProjects.filter(p => p.project_type === 'learning_development').map((project) => (
                    <SelectItem key={project.id} value={project.id} className="pl-6">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-purple-500" />
                        {project.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Assignee
              </label>
              <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                <SelectTrigger>
                  <SelectValue placeholder="Select assignee (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unassigned__">Unassigned</SelectItem>
                  <SelectItem value="Me">Me</SelectItem>
                  {assignees.map((a) => (
                    <SelectItem key={a.id} value={a.name}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Deadline
              </label>
              <Select value={selectedDeadline} onValueChange={(v) => setSelectedDeadline(v as TaskDeadlineType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {deadlineOptions.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {getDeadlineLabel(opt)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleMoveToGrowth} 
              disabled={!selectedProject || isMoving}
              className="bg-teal-500 hover:bg-teal-600"
            >
              {isMoving ? "Moving..." : "Move Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          className={cn(
            "z-50 rounded-xl border-0 shadow-2xl shadow-teal-500/20 overflow-hidden animate-scale-in bg-background transition-all duration-300",
            isExpanded ? "max-w-[calc(100vw-3rem)]" : "max-w-[calc(100vw-3rem)]"
          )}
          style={getPanelStyle()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                  <CheckSquare className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white">Quick To-Do</h3>
                  <p className="text-xs text-white/80">
                    {incompleteTasks.length} task{incompleteTasks.length !== 1 ? 's' : ''} pending
                    {urgentTasks.length > 0 && ` (${urgentTasks.length} urgent)`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-8 w-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors text-white"
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
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
          <ScrollArea className={isExpanded ? "h-[calc(100%-140px)]" : "h-[320px]"} style={{ height: isExpanded ? Math.min(600, window.innerHeight - 120) - 140 : 320 }}>
            <div className="p-3 space-y-2">
              {incompleteTasks.length === 0 && completedTasks.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8">
                  No tasks yet. Add one above!
                </p>
              )}

              {/* Urgent Section */}
              {urgentTasks.length > 0 && (
                <>
                  <div className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1 pb-1">
                    <Flame className="h-3 w-3" />
                    URGENT ({urgentTasks.length})
                  </div>
                  {urgentTasks.map((task) => (
                    <TaskRow key={task.id} task={task} isUrgentSection />
                  ))}
                  {normalTasks.length > 0 && (
                    <div className="border-t my-2" />
                  )}
                </>
              )}

              {/* Normal Tasks */}
              {normalTasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}

              {/* Completed Section */}
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
