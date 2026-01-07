import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useGrowthProjects, type GrowthProjectType } from '@/lib/hooks/useGrowthProjects';
import { Loader2 } from 'lucide-react';

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectType: GrowthProjectType | null;
  onCreated: (projectId: string) => void;
}

const projectTypeLabels: Record<GrowthProjectType, string> = {
  business_development: 'Business Development',
  professional_development: 'Professional Development',
  learning_development: 'Learning & Development',
};

export const NewProjectDialog = ({ open, onOpenChange, projectType, onCreated }: NewProjectDialogProps) => {
  const { createProject } = useGrowthProjects();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isMentee, setIsMentee] = useState(false);
  const [menteeName, setMenteeName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectType || !name.trim()) return;

    setIsSubmitting(true);
    try {
      const result = await createProject.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
        project_type: projectType,
        mentee_name: isMentee ? menteeName.trim() : null,
      });
      
      // Reset form
      setName('');
      setDescription('');
      setIsMentee(false);
      setMenteeName('');
      
      onCreated(result.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setIsMentee(false);
    setMenteeName('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New {projectType ? projectTypeLabels[projectType] : ''} Project</DialogTitle>
            <DialogDescription>
              Create a new project to track your progress and tasks
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {projectType === 'professional_development' && (
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="is-mentee">Coaching a mentee?</Label>
                  <p className="text-sm text-muted-foreground">
                    Toggle on if this is for someone you're coaching
                  </p>
                </div>
                <Switch
                  id="is-mentee"
                  checked={isMentee}
                  onCheckedChange={setIsMentee}
                />
              </div>
            )}

            {isMentee && (
              <div className="grid gap-2">
                <Label htmlFor="mentee-name">Mentee Name</Label>
                <Input
                  id="mentee-name"
                  value={menteeName}
                  onChange={(e) => setMenteeName(e.target.value)}
                  placeholder="e.g., Jack Horobin"
                  required={isMentee}
                />
              </div>
            )}
            
            <div className="grid gap-2">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  projectType === 'business_development' 
                    ? "e.g., Italian BD Initiative" 
                    : projectType === 'learning_development'
                    ? "e.g., Nuclear Energy Training Series"
                    : isMentee
                    ? "e.g., 2025 Development Plan"
                    : "e.g., My 2025 Development Goals"
                }
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the project goals..."
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
