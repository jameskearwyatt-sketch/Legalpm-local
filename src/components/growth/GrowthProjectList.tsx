import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useGrowthProjects, type GrowthProjectType, type GrowthProject } from '@/lib/hooks/useGrowthProjects';
import { formatDistanceToNow } from 'date-fns';

interface GrowthProjectListProps {
  projectType: GrowthProjectType;
  filterMentee?: boolean; // true = only mentee projects, false = only non-mentee
  title: string;
  description: string;
  icon: React.ReactNode;
  onNewProject: () => void;
  onProjectClick: (projectId: string) => void;
  compact?: boolean;
  showMenteeName?: boolean;
}

export const GrowthProjectList = ({
  projectType,
  filterMentee,
  title,
  description,
  icon,
  onNewProject,
  onProjectClick,
  compact = false,
  showMenteeName = false,
}: GrowthProjectListProps) => {
  const { projects, isLoading } = useGrowthProjects(projectType);

  const filteredProjects = filterMentee !== undefined
    ? projects.filter(p => filterMentee ? !!p.mentee_name : !p.mentee_name)
    : projects;

  const activeProjects = filteredProjects.filter(p => p.status === 'active');
  const archivedProjects = filteredProjects.filter(p => p.status !== 'active');

  if (compact) {
    return (
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : activeProjects.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">No projects yet</p>
            <Button onClick={onNewProject} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Create Project
            </Button>
          </div>
        ) : (
          <>
            {activeProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => onProjectClick(project.id)}
                showMenteeName={showMenteeName}
                compact
              />
            ))}
            <Button onClick={onNewProject} variant="ghost" size="sm" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button onClick={onNewProject}>
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : activeProjects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No active projects yet</p>
            <Button onClick={onNewProject}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activeProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => onProjectClick(project.id)}
              showMenteeName={showMenteeName}
            />
          ))}
        </div>
      )}

      {archivedProjects.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Archived Projects</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 opacity-60">
            {archivedProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => onProjectClick(project.id)}
                showMenteeName={showMenteeName}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface ProjectCardProps {
  project: GrowthProject;
  onClick: () => void;
  showMenteeName?: boolean;
  compact?: boolean;
}

const ProjectCard = ({ project, onClick, showMenteeName, compact }: ProjectCardProps) => {
  if (compact) {
    return (
      <button
        onClick={onClick}
        className="w-full text-left p-3 rounded-lg border hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">
              {showMenteeName && project.mentee_name ? project.mentee_name : project.name}
            </p>
            {project.ai_summary && (
              <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{project.ai_summary}</p>
            )}
          </div>
          <Badge variant="outline" className="ml-2 text-xs">
            {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}
          </Badge>
        </div>
      </button>
    );
  }

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">
            {showMenteeName && project.mentee_name ? project.mentee_name : project.name}
          </CardTitle>
          <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
            {project.status}
          </Badge>
        </div>
        {showMenteeName && project.mentee_name && (
          <CardDescription>{project.name}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {project.ai_summary ? (
          <p className="text-sm text-muted-foreground line-clamp-3">{project.ai_summary}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">No activity yet</p>
        )}
        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          Updated {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}
        </div>
      </CardContent>
    </Card>
  );
};
