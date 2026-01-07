import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  Plus, 
  FileText, 
  CheckCircle2, 
  Clock, 
  Upload,
  Sparkles,
  Loader2,
  Trash2,
  MoreVertical,
  ChevronDown,
  AlertCircle,
  Archive
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import AppLayout from '@/components/layout/AppLayout';
import { 
  useGrowthProject, 
  useGrowthProjects,
  useKnownAssignees,
  type TaskDeadlineType,
  getDeadlineLabel,
  calculateDueDate
} from '@/lib/hooks/useGrowthProjects';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { formatDistanceToNow, format, isPast } from 'date-fns';
import { TaskItem } from '@/components/growth/TaskItem';
import { AddEntryForm } from '@/components/growth/AddEntryForm';

const GrowthProjectDetail = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { project, entries, tasks, isLoading, isSynthesizing, addEntry, deleteEntry, addTask, updateTask, deleteTask, synthesizeProject } = useGrowthProject(projectId);
  const { updateProject, deleteProject } = useGrowthProjects();
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const pendingTasks = tasks.filter(t => !t.is_completed);
  const completedTasks = tasks.filter(t => t.is_completed);
  
  // Find overdue tasks
  const now = new Date();
  const overdueTasks = pendingTasks.filter(t => {
    if (t.deadline_type === 'no_deadline' || !t.deadline_set_at) return false;
    const dueDate = calculateDueDate(new Date(t.deadline_set_at), t.deadline_type);
    return isPast(dueDate);
  });

  const handleDeleteProject = async () => {
    if (!projectId) return;
    await deleteProject.mutateAsync(projectId);
    navigate('/growth');
  };

  const handleArchiveProject = async () => {
    if (!projectId) return;
    await updateProject.mutateAsync({ id: projectId, status: 'archived' });
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Project not found</p>
          <Button variant="link" onClick={() => navigate('/growth')}>
            Back to Growth
          </Button>
        </div>
      </AppLayout>
    );
  }

  const projectTypeLabels: Record<string, string> = {
    business_development: 'Business Development',
    professional_development: 'Professional Development',
    learning_development: 'Learning & Development',
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <Button variant="ghost" size="sm" onClick={() => navigate('/growth')} className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Growth
            </Button>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">
                {project.mentee_name || project.name}
              </h1>
              <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                {project.status}
              </Badge>
            </div>
            {project.mentee_name && (
              <p className="text-muted-foreground">{project.name}</p>
            )}
            <p className="text-sm text-muted-foreground">
              {projectTypeLabels[project.project_type]}
            </p>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleArchiveProject}>
                <Archive className="h-4 w-4 mr-2" />
                Archive Project
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setDeleteDialogOpen(true)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* AI Summary */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-yellow-500" />
                AI Summary
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={synthesizeProject}
                disabled={isSynthesizing}
              >
                {isSynthesizing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Refresh'
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {project.ai_summary ? (
              <p className="text-muted-foreground">{project.ai_summary}</p>
            ) : (
              <p className="text-muted-foreground italic">
                Add content and tasks to generate an AI summary of your project status.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Overdue Tasks Alert */}
        {overdueTasks.length > 0 && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                Overdue Tasks ({overdueTasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {overdueTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onToggle={() => updateTask.mutate({ id: task.id, is_completed: true })}
                  onUpdate={(updates) => updateTask.mutate({ id: task.id, ...updates })}
                  onDelete={() => deleteTask.mutate(task.id)}
                  isOverdue
                />
              ))}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tasks Section */}
          <Card className="lg:row-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Tasks
                </CardTitle>
                <Button size="sm" onClick={() => setShowAddTask(!showAddTask)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Task
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {showAddTask && (
                <AddTaskForm
                  projectId={projectId!}
                  onAdd={(task) => {
                    addTask.mutate(task);
                    setShowAddTask(false);
                  }}
                  onCancel={() => setShowAddTask(false)}
                />
              )}

              <div className="space-y-2">
                {pendingTasks.filter(t => !overdueTasks.find(o => o.id === t.id)).map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggle={() => updateTask.mutate({ id: task.id, is_completed: true })}
                    onUpdate={(updates) => updateTask.mutate({ id: task.id, ...updates })}
                    onDelete={() => deleteTask.mutate(task.id)}
                  />
                ))}
              </div>

              {pendingTasks.length === 0 && !showAddTask && (
                <p className="text-center text-muted-foreground py-4">No pending tasks</p>
              )}

              {completedTasks.length > 0 && (
                <>
                  <Separator />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCompleted(!showCompleted)}
                    className="w-full justify-between"
                  >
                    <span>Completed ({completedTasks.length})</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${showCompleted ? 'rotate-180' : ''}`} />
                  </Button>
                  {showCompleted && (
                    <div className="space-y-2 opacity-60">
                      {completedTasks.map((task) => (
                        <TaskItem
                          key={task.id}
                          task={task}
                          onToggle={() => updateTask.mutate({ id: task.id, is_completed: false, completed_at: null })}
                          onUpdate={(updates) => updateTask.mutate({ id: task.id, ...updates })}
                          onDelete={() => deleteTask.mutate(task.id)}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Scrapbook Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Scrapbook
                </CardTitle>
                <Button size="sm" onClick={() => setShowAddEntry(!showAddEntry)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Entry
                </Button>
              </div>
              <CardDescription>Meeting notes, documents, and updates</CardDescription>
            </CardHeader>
            <CardContent>
              {showAddEntry && (
                <AddEntryForm
                  projectId={projectId!}
                  onAdd={(entry) => {
                    addEntry.mutate(entry);
                    setShowAddEntry(false);
                  }}
                  onCancel={() => setShowAddEntry(false)}
                />
              )}

              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {entries.map((entry) => (
                    <div key={entry.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{entry.title || 'Untitled Entry'}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(entry.created_at), 'PPp')}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => deleteEntry.mutate(entry.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      {entry.content && (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {entry.content}
                        </p>
                      )}
                      {entry.file_name && (
                        <Badge variant="outline" className="text-xs">
                          <FileText className="h-3 w-3 mr-1" />
                          {entry.file_name}
                        </Badge>
                      )}
                    </div>
                  ))}
                  {entries.length === 0 && !showAddEntry && (
                    <p className="text-center text-muted-foreground py-8">
                      No entries yet. Add meeting notes, documents, or updates to track your progress.
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this project? This will permanently remove all entries and tasks. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProject} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

interface AddTaskFormProps {
  projectId: string;
  onAdd: (task: { title: string; description?: string; assignee?: string; deadline_type: TaskDeadlineType }) => void;
  onCancel: () => void;
}

const AddTaskForm = ({ projectId, onAdd, onCancel }: AddTaskFormProps) => {
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('');
  const [deadline, setDeadline] = useState<TaskDeadlineType>('no_deadline');
  const { assignees, addAssignee } = useKnownAssignees();
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);

  const deadlineOptions: { value: TaskDeadlineType; label: string }[] = [
    { value: 'this_week', label: 'This week' },
    { value: 'next_week', label: 'Next week' },
    { value: 'this_month', label: 'This month' },
    { value: 'next_month', label: 'Next month' },
    { value: 'in_3_months', label: 'In 3 months' },
    { value: 'in_6_months', label: 'In 6 months' },
    { value: 'no_deadline', label: 'No deadline' },
  ];

  const handleSubmit = () => {
    if (!title.trim()) return;
    
    // Save new assignee
    if (assignee.trim() && !assignees.find(a => a.name.toLowerCase() === assignee.toLowerCase())) {
      addAssignee.mutate(assignee.trim());
    }
    
    onAdd({
      title: title.trim(),
      assignee: assignee.trim() || undefined,
      deadline_type: deadline,
    });
  };

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
      <Input
        placeholder="What needs to be done?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />
      
      <div className="relative">
        <Input
          placeholder="Assignee (optional)"
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          onFocus={() => setShowAssigneeDropdown(true)}
          onBlur={() => setTimeout(() => setShowAssigneeDropdown(false), 200)}
        />
        {showAssigneeDropdown && assignees.length > 0 && (
          <div className="absolute top-full left-0 right-0 bg-background border rounded-md mt-1 shadow-lg z-10">
            {assignees
              .filter(a => a.name.toLowerCase().includes(assignee.toLowerCase()))
              .slice(0, 5)
              .map((a) => (
                <button
                  key={a.id}
                  className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                  onMouseDown={() => setAssignee(a.name)}
                >
                  {a.name}
                </button>
              ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {deadlineOptions.map((opt) => (
          <Button
            key={opt.value}
            type="button"
            size="sm"
            variant={deadline === opt.value ? 'default' : 'outline'}
            onClick={() => setDeadline(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={handleSubmit} disabled={!title.trim()}>Add Task</Button>
      </div>
    </div>
  );
};

export default GrowthProjectDetail;
