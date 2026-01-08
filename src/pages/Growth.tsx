import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Briefcase, 
  GraduationCap, 
  BookOpen, 
  Plus,
  Rocket,
  Target,
  Users,
  ArrowRight,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { useGrowthProjects, useOverdueTasks, useAllTasksByCategory, calculateDueDate, getDeadlineLabel, type GrowthProjectType, type TaskWithProject } from '@/lib/hooks/useGrowthProjects';
import AppLayout from '@/components/layout/AppLayout';
import { GrowthProjectList } from '@/components/growth/GrowthProjectList';
import { NewProjectDialog } from '@/components/growth/NewProjectDialog';
import { cn } from '@/lib/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isPast } from 'date-fns';
import { getDeadlineTextColor } from '@/lib/deadlineColors';
import { supabase } from '@/integrations/supabase/client';

const Growth = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [newProjectType, setNewProjectType] = useState<GrowthProjectType | null>(null);
  const { overdueCount } = useOverdueTasks();
  const { bdTasks, pdTasks, ldTasks, isLoading: tasksLoading } = useAllTasksByCategory();
  const queryClient = useQueryClient();

  const toggleTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('growth_tasks')
        .update({ is_completed: true, completed_at: new Date().toISOString() })
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-growth-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-tasks'] });
    },
  });

  const handleNewProject = (type: GrowthProjectType) => {
    setNewProjectType(type);
  };

  const handleProjectClick = (projectId: string) => {
    navigate(`/growth/${projectId}`);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Rocket className="h-8 w-8 text-primary" />
              Growth
            </h1>
            <p className="text-muted-foreground mt-1">
              Track your business, professional, and learning development
            </p>
          </div>
          {overdueCount > 0 && (
            <Badge variant="destructive" className="text-sm px-3 py-1">
              <Clock className="h-4 w-4 mr-1" />
              {overdueCount} overdue {overdueCount === 1 ? 'task' : 'tasks'}
            </Badge>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="business" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Business
            </TabsTrigger>
            <TabsTrigger value="professional" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Professional
            </TabsTrigger>
            <TabsTrigger value="learning" className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              Learning
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <OverviewCard
                title="Business Development"
                description="Client relationships, BD initiatives, and growth opportunities"
                icon={<Briefcase className="h-8 w-8" />}
                color="bg-blue-500/10 text-blue-600"
                onExplore={() => setActiveTab('business')}
                onNew={() => handleNewProject('business_development')}
                myTasks={bdTasks.myTasks}
                othersTasks={bdTasks.othersTasks}
                onToggleTask={(id) => toggleTaskMutation.mutate(id)}
                onTaskClick={(projectId) => navigate(`/growth/${projectId}`)}
              />
              <OverviewCard
                title="Professional Development"
                description="Your growth journey and mentoring your team"
                icon={<Users className="h-8 w-8" />}
                color="bg-purple-500/10 text-purple-600"
                onExplore={() => setActiveTab('professional')}
                onNew={() => handleNewProject('professional_development')}
                myTasks={pdTasks.myTasks}
                othersTasks={pdTasks.othersTasks}
                onToggleTask={(id) => toggleTaskMutation.mutate(id)}
                onTaskClick={(projectId) => navigate(`/growth/${projectId}`)}
              />
              <OverviewCard
                title="Learning & Development"
                description="Thought leadership, training, articles, and podcasts"
                icon={<GraduationCap className="h-8 w-8" />}
                color="bg-emerald-500/10 text-emerald-600"
                onExplore={() => setActiveTab('learning')}
                onNew={() => handleNewProject('learning_development')}
                myTasks={ldTasks.myTasks}
                othersTasks={ldTasks.othersTasks}
                onToggleTask={(id) => toggleTaskMutation.mutate(id)}
                onTaskClick={(projectId) => navigate(`/growth/${projectId}`)}
              />
            </div>
          </TabsContent>

          <TabsContent value="business" className="mt-6">
            <GrowthProjectList 
              projectType="business_development"
              title="Business Development"
              description="Track BD initiatives, client relationships, and growth opportunities"
              icon={<Briefcase className="h-5 w-5" />}
              onNewProject={() => handleNewProject('business_development')}
              onProjectClick={handleProjectClick}
            />
          </TabsContent>

          <TabsContent value="professional" className="mt-6">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    My Development
                  </CardTitle>
                  <CardDescription>Your own professional development journey</CardDescription>
                </CardHeader>
                <CardContent>
                  <GrowthProjectList 
                    projectType="professional_development"
                    filterMentee={false}
                    title=""
                    description=""
                    icon={null}
                    onNewProject={() => handleNewProject('professional_development')}
                    onProjectClick={handleProjectClick}
                    compact
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    My Mentees
                  </CardTitle>
                  <CardDescription>Associates and team members you're coaching</CardDescription>
                </CardHeader>
                <CardContent>
                  <GrowthProjectList 
                    projectType="professional_development"
                    filterMentee={true}
                    title=""
                    description=""
                    icon={null}
                    onNewProject={() => handleNewProject('professional_development')}
                    onProjectClick={handleProjectClick}
                    compact
                    showMenteeName
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="learning" className="mt-6">
            <GrowthProjectList 
              projectType="learning_development"
              title="Learning & Development"
              description="Thought leadership, training sessions, articles, and podcasts"
              icon={<GraduationCap className="h-5 w-5" />}
              onNewProject={() => handleNewProject('learning_development')}
              onProjectClick={handleProjectClick}
            />
          </TabsContent>
        </Tabs>
      </div>

      <NewProjectDialog
        open={newProjectType !== null}
        onOpenChange={(open) => !open && setNewProjectType(null)}
        projectType={newProjectType}
        onCreated={(projectId) => {
          setNewProjectType(null);
          navigate(`/growth/${projectId}`);
        }}
      />
    </AppLayout>
  );
};

interface OverviewCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  onExplore: () => void;
  onNew: () => void;
  myTasks: TaskWithProject[];
  othersTasks: TaskWithProject[];
  onToggleTask: (taskId: string) => void;
  onTaskClick: (projectId: string) => void;
}

const TaskRow = ({ 
  task, 
  onToggle, 
  onClick 
}: { 
  task: TaskWithProject; 
  onToggle: () => void; 
  onClick: () => void;
}) => {
  const now = new Date();
  const dueDate = task.deadline_set_at 
    ? calculateDueDate(new Date(task.deadline_set_at), task.deadline_type) 
    : null;
  const isOverdue = dueDate && isPast(dueDate);
  
  // Get text color based on deadline
  const titleColor = getDeadlineTextColor(dueDate, false);

  return (
    <div 
      className={cn(
        "flex items-start gap-2 py-1.5 group"
      )}
    >
      <Checkbox
        checked={false}
        onCheckedChange={() => onToggle()}
        className="mt-0.5 shrink-0"
      />
      <div className="flex-1 min-w-0">
        <button
          onClick={onClick}
          className={cn(
            "text-left text-sm hover:underline truncate block w-full",
            titleColor
          )}
        >
          {task.title}
        </button>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{task.growth_projects.name}</span>
          {task.assignee && task.assignee !== 'Me' && (
            <>
              <span>•</span>
              <span className="font-medium text-foreground/70">{task.assignee}</span>
            </>
          )}
          {task.deadline_type !== 'no_deadline' && (
            <>
              <span>•</span>
              <span className={cn(isOverdue && "text-destructive font-medium flex items-center gap-1")}>
                {isOverdue && <AlertTriangle className="h-3 w-3" />}
                {getDeadlineLabel(task.deadline_type)}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const OverviewCard = ({ 
  title, 
  description, 
  icon, 
  color, 
  onExplore, 
  onNew,
  myTasks,
  othersTasks,
  onToggleTask,
  onTaskClick
}: OverviewCardProps) => {
  const totalTasks = myTasks.length + othersTasks.length;

  return (
    <Card className="group hover:shadow-lg transition-shadow flex flex-col">
      <CardHeader className="pb-3">
        <div className={`w-16 h-16 rounded-xl ${color} flex items-center justify-center mb-3`}>
          {icon}
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {totalTasks > 0 ? (
          <div className="flex-1 space-y-3 mb-4 max-h-[280px] overflow-y-auto">
            {myTasks.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">My Tasks</p>
                <div className="space-y-0.5">
                  {myTasks.map(task => (
                    <TaskRow 
                      key={task.id} 
                      task={task} 
                      onToggle={() => onToggleTask(task.id)}
                      onClick={() => onTaskClick(task.project_id)}
                    />
                  ))}
                </div>
              </div>
            )}
            {othersTasks.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Others' Tasks</p>
                <div className="space-y-0.5">
                  {othersTasks.map(task => (
                    <TaskRow 
                      key={task.id} 
                      task={task} 
                      onToggle={() => onToggleTask(task.id)}
                      onClick={() => onTaskClick(task.project_id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm py-4">
            No pending tasks
          </div>
        )}
        <div className="flex gap-2 mt-auto pt-2 border-t">
          <Button variant="outline" onClick={onExplore} className="flex-1">
            Explore
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
          <Button onClick={onNew} size="icon">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default Growth;
