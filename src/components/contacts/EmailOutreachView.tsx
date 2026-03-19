import { useState } from "react";
import DOMPurify from "dompurify";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useDistributionEmailDrafts,
  useUpdateDistributionEmailDraft,
  useDeleteDistributionEmailDraft,
} from "@/lib/hooks/useDistributionEmailDrafts";
import { Mail, Trash2, Check, Calendar, Users, Send } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function EmailOutreachView() {
  const { data: drafts = [], isLoading } = useDistributionEmailDrafts();
  const updateDraft = useUpdateDistributionEmailDraft();
  const deleteDraft = useDeleteDistributionEmailDraft();
  
  const [confirmSentDialog, setConfirmSentDialog] = useState<string | null>(null);
  const [sentDate, setSentDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [draftToDelete, setDraftToDelete] = useState<string | null>(null);
  const [expandedDraft, setExpandedDraft] = useState<string | null>(null);

  const handleConfirmSent = async () => {
    if (!confirmSentDialog) return;
    await updateDraft.mutateAsync({
      id: confirmSentDialog,
      was_sent: true,
      sent_date: sentDate,
    });
    setConfirmSentDialog(null);
  };

  const handleUnmarkSent = async (id: string) => {
    await updateDraft.mutateAsync({
      id,
      was_sent: false,
      sent_date: null,
    });
  };

  const handleDelete = async () => {
    if (!draftToDelete) return;
    await deleteDraft.mutateAsync(draftToDelete);
    setDraftToDelete(null);
  };

  const sentCount = drafts.filter(d => d.was_sent).length;
  const pendingCount = drafts.filter(d => !d.was_sent).length;

  const getDraftTypeLabel = (type: string) => {
    switch (type) {
      case "event_invitation": return "Event Invitation";
      case "article_sharing": return "Article Sharing";
      case "firm_update": return "Firm Update";
      default: return type;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Email Outreach Log</h2>
          <p className="text-sm text-muted-foreground">
            Track emails drafted and sent to your email client
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <Send className="h-4 w-4 text-primary" />
            <span>{sentCount} sent</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span>{pendingCount} pending</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading email history...</p>
      ) : drafts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Mail className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No email drafts yet.</p>
            <p className="text-sm text-muted-foreground">
              Emails drafted from the Contacts tab will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Sent</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-center">Recipients</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Sent Date</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drafts.map((draft) => (
                <>
                  <TableRow 
                    key={draft.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setExpandedDraft(expandedDraft === draft.id ? null : draft.id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={draft.was_sent}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setConfirmSentDialog(draft.id);
                          } else {
                            handleUnmarkSent(draft.id);
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {draft.was_sent && (
                          <Check className="h-4 w-4 text-primary shrink-0" />
                        )}
                        <span className="truncate max-w-[300px]">{draft.subject}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {getDraftTypeLabel(draft.draft_type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        {draft.recipient_count}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(draft.created_at), "d MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      {draft.was_sent && draft.sent_date ? (
                        <div className="flex items-center gap-1 text-sm text-primary">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(draft.sent_date), "d MMM yyyy")}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setDraftToDelete(draft.id)}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedDraft === draft.id && (
                    <TableRow key={`${draft.id}-expanded`}>
                      <TableCell colSpan={7} className="bg-muted/30 p-4">
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Email Body</p>
                            <div 
                              className="text-sm bg-background p-3 rounded border max-h-[200px] overflow-y-auto whitespace-pre-wrap"
                              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(draft.body) }}
                            />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              Recipients ({draft.recipient_count})
                            </p>
                            <div className="text-sm text-muted-foreground">
                              {draft.recipient_emails.slice(0, 10).join(", ")}
                              {draft.recipient_emails.length > 10 && (
                                <span> and {draft.recipient_emails.length - 10} more...</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Confirm Sent Dialog */}
      <Dialog open={!!confirmSentDialog} onOpenChange={() => setConfirmSentDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Email Sent</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please confirm the date this email was sent to your contacts.
            </p>
            <div className="space-y-2">
              <Label htmlFor="sent-date">Date Sent</Label>
              <Input
                id="sent-date"
                type="date"
                value={sentDate}
                onChange={(e) => setSentDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSentDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSent} disabled={updateDraft.isPending}>
              <Check className="h-4 w-4 mr-2" />
              Confirm Sent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!draftToDelete} onOpenChange={() => setDraftToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Email Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this email record? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}