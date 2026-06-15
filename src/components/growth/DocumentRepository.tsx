import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FolderOpen,
  Upload,
  FileText,
  Loader2,
  ExternalLink,
  Trash2,
  Eye,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export interface GrowthDocument {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  file_url: string;
  file_name: string;
  file_type: string | null;
  ai_summary: string | null;
  summary_generated_at: string | null;
  created_at: string;
  updated_at: string;
}

interface DocumentRepositoryProps {
  projectId: string;
  projectName: string;
  projectType: string;
  documents: GrowthDocument[];
  onDocumentAdded: () => void;
  onDocumentDeleted: (id: string) => void;
  onSummaryGenerated: (id: string, summary: string) => void;
}

export const DocumentRepository = ({
  projectId,
  projectName,
  projectType,
  documents,
  onDocumentAdded,
  onDocumentDeleted,
  onSummaryGenerated,
}: DocumentRepositoryProps) => {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [title, setTitle] = useState('');
  const [viewingSummary, setViewingSummary] = useState<GrowthDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    setIsUploading(true);
    setUploadProgress({ current: 0, total: files.length });

    let uploadedCount = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress({ current: i + 1, total: files.length });

        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${i}.${fileExt}`;
        const filePath = `${user.id}/${projectId}/documents/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('growth-files')
          .upload(filePath, file);

        if (uploadError) {
          toast.error(`Failed to upload ${file.name}: ${uploadError.message}`);
          continue;
        }

        const docTitle = files.length === 1 && title.trim() ? title.trim() : file.name;

        const { error: insertError } = await supabase
          .from('growth_project_documents')
          .insert({
            project_id: projectId,
            user_id: user.id,
            title: docTitle,
            file_url: filePath,
            file_name: file.name,
            file_type: file.type,
          })
          .select()
          .single();

        if (insertError) {
          toast.error(`Failed to save ${file.name}: ${insertError.message}`);
          continue;
        }

        uploadedCount++;
      }

      onDocumentAdded();
      setShowUpload(false);
      setTitle('');

      if (uploadedCount > 0) {
        toast.success(`Uploaded ${uploadedCount} document${uploadedCount > 1 ? 's' : ''}`);
      }
    } catch (error: any) {
      toast.error('Failed to upload documents: ' + error.message);
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getFileUrl = async (filePath: string): Promise<string | null> => {
    if (filePath.startsWith('http')) return filePath;
    const { data } = await supabase.storage
      .from('growth-files')
      .createSignedUrl(filePath, 3600);
    return data?.signedUrl || null;
  };

  const handleDelete = async (docId: string) => {
    try {
      const { error } = await supabase
        .from('growth_project_documents')
        .delete()
        .eq('id', docId);

      if (error) throw error;

      onDocumentDeleted(docId);
      toast.success('Document deleted');
    } catch (error: any) {
      toast.error('Failed to delete document: ' + error.message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Document Repository
          </CardTitle>
          <Button size="sm" onClick={() => setShowUpload(!showUpload)}>
            <Upload className="h-4 w-4 mr-1" />
            Upload
          </Button>
        </div>
        <CardDescription>Reference documents for this project (stored locally)</CardDescription>
      </CardHeader>
      <CardContent>
        {showUpload && (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30 mb-4">
            <Input
              placeholder="Document title (optional, for single file)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Uploading{uploadProgress ? ` ${uploadProgress.current} of ${uploadProgress.total}` : ''}...
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Click to upload documents</p>
                  <p className="text-xs text-muted-foreground">You can select multiple files</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                accept=".pdf,.doc,.docx,.txt,.md,.xls,.xlsx,.ppt,.pptx"
                multiple
              />
            </div>
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => { setShowUpload(false); setTitle(''); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(doc.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {doc.ai_summary && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setViewingSummary(doc)}
                      title="View AI Summary"
                    >
                      <Eye className="h-4 w-4 text-yellow-500" />
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={async () => {
                      const url = await getFileUrl(doc.file_url);
                      if (url) {
                        window.open(url, '_blank');
                      } else {
                        toast.error('Failed to access document');
                      }
                    }}
                    title="Open Document"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        title="Delete Document"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Document</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{doc.title}"? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(doc.id)}
                          className="bg-destructive text-destructive-foreground"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}

            {documents.length === 0 && !showUpload && (
              <p className="text-center text-muted-foreground py-8">
                No documents yet. Upload reference materials for your project.
              </p>
            )}
          </div>
        </ScrollArea>
      </CardContent>

      {/* View Summary Dialog */}
      <Dialog open={!!viewingSummary} onOpenChange={() => setViewingSummary(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI Summary</DialogTitle>
            <DialogDescription>
              {viewingSummary?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 p-4 bg-muted/50 rounded-lg">
            <p className="text-sm leading-relaxed">{viewingSummary?.ai_summary}</p>
          </div>
          {viewingSummary?.summary_generated_at && (
            <p className="text-xs text-muted-foreground mt-2">
              Generated on {format(new Date(viewingSummary.summary_generated_at), 'MMM d, yyyy h:mm a')}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
