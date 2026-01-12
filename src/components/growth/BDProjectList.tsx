import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Clock, 
  Loader2, 
  Star, 
  ArrowUpDown,
  Calendar,
  SortAsc,
  Activity
} from 'lucide-react';
import { useGrowthProjects, type GrowthProject } from '@/lib/hooks/useGrowthProjects';
import { formatDistanceToNow } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type SortOption = 'updated' | 'created' | 'name' | 'activity';

interface BDProjectListProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onNewProject: () => void;
  onProjectClick: (projectId: string) => void;
}

const sortLabels: Record<SortOption, string> = {
  updated: 'Last Updated',
  created: 'Date Created',
  name: 'Name (A-Z)',
  activity: 'Most Active',
};

export const BDProjectList = ({
  title,
  description,
  icon,
  onNewProject,
  onProjectClick,
}: BDProjectListProps) => {
  const { projects, isLoading, updateProject } = useGrowthProjects('business_development');
  const [sortBy, setSortBy] = useState<SortOption>('updated');

  const activeProjects = projects.filter(p => p.status === 'active');
  const archivedProjects = projects.filter(p => p.status !== 'active');

  const { starredProjects, unstarredProjects } = useMemo(() => {
    const starred = activeProjects.filter(p => p.is_starred);
    const unstarred = activeProjects.filter(p => !p.is_starred);

    // Sort unstarred projects based on selected sort option
    const sortedUnstarred = [...unstarred].sort((a, b) => {
      switch (sortBy) {
        case 'updated':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        case 'created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'name':
          return a.name.localeCompare(b.name);
        case 'activity':
          // Sort by updated_at as a proxy for activity
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        default:
          return 0;
      }
    });

    // Sort starred by updated_at
    const sortedStarred = [...starred].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    return { starredProjects: sortedStarred, unstarredProjects: sortedUnstarred };
  }, [activeProjects, sortBy]);

  const toggleStar = (e: React.MouseEvent, project: GrowthProject) => {
    e.stopPropagation();
    updateProject.mutate({ id: project.id, is_starred: !project.is_starred });
  };

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
        <div className="border rounded-lg p-12 text-center">
          <p className="text-muted-foreground mb-4">No active projects yet</p>
          <Button onClick={onNewProject}>
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Project
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Starred Projects Section */}
          {starredProjects.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                Starred
              </div>
              <div className="space-y-1">
                {starredProjects.map((project) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    onClick={() => onProjectClick(project.id)}
                    onToggleStar={(e) => toggleStar(e, project)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Other Projects Section with Sort */}
          {unstarredProjects.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  {starredProjects.length > 0 ? 'Other Projects' : 'All Projects'}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 text-xs">
                      <ArrowUpDown className="h-3 w-3 mr-1" />
                      {sortLabels[sortBy]}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setSortBy('updated')}>
                      <Clock className="h-4 w-4 mr-2" />
                      Last Updated
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('created')}>
                      <Calendar className="h-4 w-4 mr-2" />
                      Date Created
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('name')}>
                      <SortAsc className="h-4 w-4 mr-2" />
                      Name (A-Z)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('activity')}>
                      <Activity className="h-4 w-4 mr-2" />
                      Most Active
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="space-y-1">
                {unstarredProjects.map((project) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    onClick={() => onProjectClick(project.id)}
                    onToggleStar={(e) => toggleStar(e, project)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {archivedProjects.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Archived Projects</h3>
          <div className="space-y-1 opacity-60">
            {archivedProjects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                onClick={() => onProjectClick(project.id)}
                onToggleStar={(e) => toggleStar(e, project)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface ProjectRowProps {
  project: GrowthProject;
  onClick: () => void;
  onToggleStar: (e: React.MouseEvent) => void;
}

const ProjectRow = ({ project, onClick, onToggleStar }: ProjectRowProps) => {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors group"
    >
      <button
        onClick={onToggleStar}
        className={cn(
          "p-1 rounded hover:bg-accent transition-colors",
          project.is_starred ? "text-yellow-500" : "text-muted-foreground opacity-0 group-hover:opacity-100"
        )}
      >
        <Star className={cn("h-4 w-4", project.is_starred && "fill-current")} />
      </button>
      
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{project.name}</p>
        {project.ai_summary && (
          <p className="text-sm text-muted-foreground line-clamp-1">{project.ai_summary}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Badge variant={project.status === 'active' ? 'outline' : 'secondary'} className="text-xs">
          {project.status}
        </Badge>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}
        </span>
      </div>
    </div>
  );
};
