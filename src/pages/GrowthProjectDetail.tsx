import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  Plus, 
  FileText, 
  CheckCircle2, 
  Sparkles,
  Loader2,
  MoreVertical,
  ChevronDown,
  AlertCircle,
  Archive,
  Trash2,
  User,
  Calendar,
  LayoutGrid,
  ListTodo
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
  type GrowthProjectEntry,
  calculateDueDate
} from '@/lib/hooks/useGrowthProjects';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isPast, format } from 'date-fns';
import { TaskItem } from '@/components/growth/TaskItem';
import { AddEntryForm } from '@/components/growth/AddEntryForm';
import { EntryCard } from '@/components/growth/EntryCard';
import { TaskExtractionDialog, type ExtractedTask, type TaskAmendment, type CompletedTaskSuggestion } from '@/components/growth/TaskExtractionDialog';
import { DocumentRepository } from '@/components/growth/DocumentRepository';
import { TodaysFocusView, MatrixView } from '@/components/growth/TaskListViews';

const GrowthProjectDetail = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { project, entries, tasks, documents, isLoading, isSynthesizing, addEntry, deleteEntry, addTask, updateTask, deleteTask, synthesizeProject, refreshDocuments, updateDocumentSummary } = useGrowthProject(projectId);
  const { updateProject, deleteProject } = useGrowthProjects();
  const { addAssignee } = useKnownAssignees();
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskView, setTaskView] = useState<'focus' | 'matrix' | 'simple'>('focus');
  
  // Task extraction state
  const [extractedTasks, setExtractedTasks] = useState<ExtractedTask[]>([]);
  const [taskAmendments, setTaskAmendments] = useState<TaskAmendment[]>([]);
  const [completedTaskSuggestions, setCompletedTaskSuggestions] = useState<CompletedTaskSuggestion[]>([]);
  const [showTaskExtraction, setShowTaskExtraction] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);

  const pendingTasks = useMemo(() => tasks.filter(t => !t.is_completed), [tasks]);
  const completedTasks = useMemo(() => tasks.filter(t => t.is_completed), [tasks]);
  
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

  // Handle new entry with task extraction
  const handleAddEntry = async (entry: Partial<GrowthProjectEntry>) => {
    // Add the entry first
    await addEntry.mutateAsync(entry);
    setShowAddEntry(false);

    // If there's text content, extract tasks
    if (entry.content && entry.content.trim().length > 20 && project) {
      setIsExtracting(true);
      setShowTaskExtraction(true);

      try {
        // Pass existing tasks for context
        const existingTasksForAI = tasks.map(t => ({
          id: t.id,
          title: t.title,
          assignee: t.assignee,
          is_completed: t.is_completed,
        }));

        // Pass existing entries for context (excluding the one just added)
        const existingEntriesForAI = entries.map(e => ({
          title: e.title,
          content: e.content,
          entry_type: e.entry_type,
          created_at: e.created_at,
        }));

        const { data, error } = await supabase.functions.invoke('extract-tasks', {
          body: {
            newEntryContent: entry.content,
            projectName: project.name,
            projectType: project.project_type,
            existingTasks: existingTasksForAI,
            existingEntries: existingEntriesForAI,
          },
        });

        if (error) throw error;

        // Process new tasks
        const newTasks = (data?.tasks || []).map((t: { title: string; assignee?: string; deadline_type: string }) => ({
          ...t,
          deadline_type: t.deadline_type as TaskDeadlineType,
          selected: true,
        }));
        setExtractedTasks(newTasks);

        // Process amendments - match with existing task IDs
        const amendments = (data?.amendments || []).map((a: { original_task_title: string; suggested_title?: string; suggested_assignee?: string; suggested_deadline_type?: string; reason: string }) => {
          const matchingTask = tasks.find(t => t.title.toLowerCase() === a.original_task_title.toLowerCase());
          return {
            ...a,
            original_task_id: matchingTask?.id,
            suggested_deadline_type: a.suggested_deadline_type as TaskDeadlineType | undefined,
            selected: true,
          };
        });
        setTaskAmendments(amendments);

        // Process completed tasks - match with existing task IDs
        const completed = (data?.completedTasks || []).map((c: { original_task_title: string; evidence: string }) => {
          const matchingTask = tasks.find(t => t.title.toLowerCase() === c.original_task_title.toLowerCase());
          return {
            ...c,
            original_task_id: matchingTask?.id,
            selected: true,
          };
        });
        setCompletedTaskSuggestions(completed);

      } catch (err) {
        console.error('Task extraction error:', err);
        toast.error('Could not extract tasks from content');
        setShowTaskExtraction(false);
      } finally {
        setIsExtracting(false);
      }
    }
  };

  // Handle confirming extracted tasks - dialog closes immediately to prevent double-clicks
  const handleConfirmExtractedTasks = async (
    newTasks: ExtractedTask[], 
    amendments: TaskAmendment[], 
    completed: CompletedTaskSuggestion[]
  ) => {
    // Dialog is already closed by the dialog component
    setExtractedTasks([]);
    setTaskAmendments([]);
    setCompletedTaskSuggestions([]);
    
    let addedCount = 0;
    let amendedCount = 0;
    let completedCount = 0;

    // Process new tasks
    for (const task of newTasks) {
      try {
        if (task.assignee && task.assignee !== 'Me') {
          addAssignee.mutate(task.assignee);
        }
        await addTask.mutateAsync({
          title: task.title,
          assignee: task.assignee || undefined,
          deadline_type: task.deadline_type,
        });
        addedCount++;
      } catch (err) {
        console.error('Failed to add task:', err);
      }
    }

    // Process amendments
    for (const amendment of amendments) {
      if (!amendment.original_task_id) continue;
      try {
        const updates: Record<string, unknown> = {};
        if (amendment.suggested_title) updates.title = amendment.suggested_title;
        if (amendment.suggested_assignee) {
          updates.assignee = amendment.suggested_assignee || undefined;
          if (amendment.suggested_assignee !== 'Me') {
            addAssignee.mutate(amendment.suggested_assignee);
          }
        }
        if (amendment.suggested_deadline_type) {
          updates.deadline_type = amendment.suggested_deadline_type;
          updates.deadline_set_at = new Date().toISOString();
        }
        if (Object.keys(updates).length > 0) {
          await updateTask.mutateAsync({ id: amendment.original_task_id, ...updates });
          amendedCount++;
        }
      } catch (err) {
        console.error('Failed to amend task:', err);
      }
    }

    // Process completed tasks
    for (const completedTask of completed) {
      if (!completedTask.original_task_id) continue;
      try {
        await updateTask.mutateAsync({ 
          id: completedTask.original_task_id, 
          is_completed: true,
          completed_at: new Date().toISOString(),
          completion_notes: completedTask.completion_notes || null,
        });
        completedCount++;
      } catch (err) {
        console.error('Failed to mark task complete:', err);
      }
    }
    
    // Show summary toast
    const parts = [];
    if (addedCount > 0) parts.push(`${addedCount} added`);
    if (amendedCount > 0) parts.push(`${amendedCount} amended`);
    if (completedCount > 0) parts.push(`${completedCount} completed`);
    if (parts.length > 0) {
      toast.success(`Tasks: ${parts.join(', ')}`);
    }
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
                  onToggle={(notes) => updateTask.mutate({ id: task.id, is_completed: true, completion_notes: notes || null })}
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
                <div className="flex items-center gap-2">
                  <Tabs value={taskView} onValueChange={(v) => setTaskView(v as typeof taskView)} className="h-8">
                    <TabsList className="h-8">
                      <TabsTrigger value="focus" className="h-7 px-2 text-xs gap-1">
                        <ListTodo className="h-3.5 w-3.5" />
                        Focus
                      </TabsTrigger>
                      <TabsTrigger value="matrix" className="h-7 px-2 text-xs gap-1">
                        <LayoutGrid className="h-3.5 w-3.5" />
                        Matrix
                      </TabsTrigger>
                      <TabsTrigger value="simple" className="h-7 px-2 text-xs">
                        Simple
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Button size="sm" onClick={() => setShowAddTask(!showAddTask)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
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

              {taskView === 'focus' && (
                <TodaysFocusView
                  tasks={tasks}
                  onUpdateTask={(id, updates) => updateTask.mutate({ id, ...updates })}
                  onDeleteTask={(id) => deleteTask.mutate(id)}
                  onToggleComplete={(id, notes) => updateTask.mutate({ id, is_completed: true, completion_notes: notes || null })}
                />
              )}

              {taskView === 'matrix' && (
                <MatrixView
                  tasks={tasks}
                  onUpdateTask={(id, updates) => updateTask.mutate({ id, ...updates })}
                  onDeleteTask={(id) => deleteTask.mutate(id)}
                  onToggleComplete={(id, notes) => updateTask.mutate({ id, is_completed: true, completion_notes: notes || null })}
                />
              )}

              {taskView === 'simple' && (
                <>
                  <div className="space-y-2">
                    {pendingTasks.filter(t => !overdueTasks.find(o => o.id === t.id)).map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        onToggle={(notes) => updateTask.mutate({ id: task.id, is_completed: true, completion_notes: notes || null })}
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
                              onToggle={() => updateTask.mutate({ id: task.id, is_completed: false, completed_at: null, completion_notes: null })}
                              onUpdate={(updates) => updateTask.mutate({ id: task.id, ...updates })}
                              onDelete={() => deleteTask.mutate(task.id)}
                            />
                          ))}
                        </div>
                      )}
                    </>
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
                  onAdd={handleAddEntry}
                  onCancel={() => setShowAddEntry(false)}
                />
              )}

              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-2">
                  {entries.map((entry) => (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      onDelete={() => deleteEntry.mutate(entry.id)}
                    />
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

          {/* Document Repository Section */}
          <DocumentRepository
            projectId={projectId!}
            projectName={project.name}
            projectType={project.project_type}
            documents={documents}
            onDocumentAdded={refreshDocuments}
            onDocumentDeleted={() => refreshDocuments()}
            onSummaryGenerated={updateDocumentSummary}
          />
        </div>
      </div>

      {/* Task Extraction Dialog */}
      <TaskExtractionDialog
        open={showTaskExtraction}
        onOpenChange={setShowTaskExtraction}
        tasks={extractedTasks}
        amendments={taskAmendments}
        completedTasks={completedTaskSuggestions}
        onTasksChange={setExtractedTasks}
        onAmendmentsChange={setTaskAmendments}
        onCompletedTasksChange={setCompletedTaskSuggestions}
        onConfirm={handleConfirmExtractedTasks}
        isLoading={isExtracting}
      />

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
