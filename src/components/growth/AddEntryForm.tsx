import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { type GrowthProjectEntry } from '@/lib/hooks/useGrowthProjects';

interface AddEntryFormProps {
  projectId: string;
  onAdd: (entry: Partial<GrowthProjectEntry>) => void;
  onCancel: () => void;
}

export const AddEntryForm = ({ projectId, onAdd, onCancel }: AddEntryFormProps) => {
  const { user } = useAuth();
  const [entryType, setEntryType] = useState<'note' | 'file'>('note');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmitNote = () => {
    if (!content.trim()) return;
    onAdd({
      entry_type: 'note',
      title: title.trim() || 'Note',
      content: content.trim(),
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${projectId}/${fileName}`;

      const { data, error } = await supabase.storage
        .from('growth-files')
        .upload(filePath, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('growth-files')
        .getPublicUrl(filePath);

      onAdd({
        entry_type: 'file',
        title: title.trim() || file.name,
        file_url: urlData.publicUrl,
        file_name: file.name,
      });
    } catch (error: any) {
      toast.error('Failed to upload file: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-muted/30 mb-4">
      <Tabs value={entryType} onValueChange={(v) => setEntryType(v as 'note' | 'file')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="note">
            <FileText className="h-4 w-4 mr-2" />
            Note
          </TabsTrigger>
          <TabsTrigger value="file">
            <Upload className="h-4 w-4 mr-2" />
            File
          </TabsTrigger>
        </TabsList>

        <TabsContent value="note" className="space-y-3 mt-3">
          <div>
            <Label htmlFor="entry-title">Title</Label>
            <Input
              id="entry-title"
              placeholder="e.g., Meeting with Italian partner"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="entry-content">Content</Label>
            <Textarea
              id="entry-content"
              placeholder="Paste meeting notes, action items, or any relevant content..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
            <Button size="sm" onClick={handleSubmitNote} disabled={!content.trim()}>
              Add Note
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="file" className="space-y-3 mt-3">
          <div>
            <Label htmlFor="file-title">Title (optional)</Label>
            <Input
              id="file-title"
              placeholder="Description for this file"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div 
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Uploading...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click to upload a file
                </p>
                <p className="text-xs text-muted-foreground">
                  PDFs, documents, images supported
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
