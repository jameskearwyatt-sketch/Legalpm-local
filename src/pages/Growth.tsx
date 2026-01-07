import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Briefcase, 
  GraduationCap, 
  BookOpen, 
  Plus,
  Rocket,
  Target,
  Users,
  Lightbulb,
  ArrowRight,
  Clock
} from 'lucide-react';
import { useGrowthProjects, useOverdueTasks, type GrowthProjectType } from '@/lib/hooks/useGrowthProjects';
import AppLayout from '@/components/layout/AppLayout';
import { GrowthProjectList } from '@/components/growth/GrowthProjectList';
import { NewProjectDialog } from '@/components/growth/NewProjectDialog';

const Growth = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [newProjectType, setNewProjectType] = useState<GrowthProjectType | null>(null);
  const { overdueCount } = useOverdueTasks();

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
              />
              <OverviewCard
                title="Professional Development"
                description="Your growth journey and mentoring your team"
                icon={<Users className="h-8 w-8" />}
                color="bg-purple-500/10 text-purple-600"
                onExplore={() => setActiveTab('professional')}
                onNew={() => handleNewProject('professional_development')}
              />
              <OverviewCard
                title="Learning & Development"
                description="Thought leadership, training, articles, and podcasts"
                icon={<GraduationCap className="h-8 w-8" />}
                color="bg-emerald-500/10 text-emerald-600"
                onExplore={() => setActiveTab('learning')}
                onNew={() => handleNewProject('learning_development')}
              />
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-yellow-500" />
                  Quick Tips
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm dark:prose-invert max-w-none">
                <ul className="space-y-2 text-muted-foreground">
                  <li>Create projects to track BD initiatives, coaching relationships, or training programs</li>
                  <li>Paste meeting notes, emails, or upload documents to keep everything in one place</li>
                  <li>Set quick deadlines (this week, next month, etc.) without fiddling with calendars</li>
                  <li>AI automatically summarizes your progress as you add content</li>
                  <li>Never lose track of tasks - they'll surface when they're due</li>
                </ul>
              </CardContent>
            </Card>
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
}

const OverviewCard = ({ title, description, icon, color, onExplore, onNew }: OverviewCardProps) => {
  return (
    <Card className="group hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className={`w-16 h-16 rounded-xl ${color} flex items-center justify-center mb-3`}>
          {icon}
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Button variant="outline" onClick={onExplore} className="flex-1">
          Explore
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
        <Button onClick={onNew} size="icon">
          <Plus className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
};

export default Growth;
