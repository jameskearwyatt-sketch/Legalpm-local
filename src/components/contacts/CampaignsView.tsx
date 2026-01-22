import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  useDistributionCampaigns,
  useCreateDistributionCampaign,
  useDeleteDistributionCampaign,
  type DistributionCampaign,
} from "@/lib/hooks/useDistributionCampaigns";
import { useDistributionContacts, type ContactFilters } from "@/lib/hooks/useDistributionContacts";
import { useDistributionEmailDrafts } from "@/lib/hooks/useDistributionEmailDrafts";
import { Plus, Trash2, FolderOpen, Mail, Users, Calendar } from "lucide-react";

export function CampaignsView() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [campaignToDelete, setCampaignToDelete] = useState<DistributionCampaign | null>(null);
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);

  const { data: campaigns = [], isLoading } = useDistributionCampaigns();
  const createCampaign = useCreateDistributionCampaign();
  const deleteCampaign = useDeleteDistributionCampaign();

  const handleCreate = async () => {
    if (!newCampaignName.trim()) return;
    await createCampaign.mutateAsync({
      name: newCampaignName.trim(),
      filters: {},
    });
    setNewCampaignName("");
    setShowCreateDialog(false);
  };

  const handleDelete = async () => {
    if (!campaignToDelete) return;
    await deleteCampaign.mutateAsync(campaignToDelete.id);
    setCampaignToDelete(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Campaigns</h2>
          <p className="text-sm text-muted-foreground">
            Group contacts and track email drafts for events and distributions
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading campaigns...</p>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No campaigns yet.</p>
            <p className="text-sm text-muted-foreground">
              Create a campaign to group contacts for an event or distribution.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              isExpanded={expandedCampaign === campaign.id}
              onExpand={() => setExpandedCampaign(expandedCampaign === campaign.id ? null : campaign.id)}
              onDelete={() => setCampaignToDelete(campaign)}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Campaign name (e.g. Women in Mining Dinner – March 2026)"
              value={newCampaignName}
              onChange={(e) => setNewCampaignName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!newCampaignName.trim() || createCampaign.isPending}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!campaignToDelete} onOpenChange={() => setCampaignToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{campaignToDelete?.name}"? 
              Associated email drafts will also be deleted.
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

function CampaignCard({ 
  campaign, 
  isExpanded, 
  onExpand, 
  onDelete 
}: { 
  campaign: DistributionCampaign;
  isExpanded: boolean;
  onExpand: () => void;
  onDelete: () => void;
}) {
  const filters = campaign.saved_filters as ContactFilters;
  const { data: contacts = [] } = useDistributionContacts(filters);
  const { data: drafts = [] } = useDistributionEmailDrafts(campaign.id);
  
  const contactableCount = contacts.filter(c => !c.do_not_contact).length;
  const filterCount = Object.values(filters).filter(v => v !== undefined && v !== "").length;

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onExpand}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base">{campaign.name}</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 -mr-2 -mt-1"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
          </Button>
        </div>
        <CardDescription className="flex items-center gap-2 text-xs">
          <Calendar className="h-3 w-3" />
          Created {format(new Date(campaign.created_at), "d MMM yyyy")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>{contactableCount} contacts</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span>{drafts.length} drafts</span>
          </div>
        </div>

        {filterCount > 0 && (
          <div className="flex flex-wrap gap-1">
            {filters.sectors?.map(s => (
              <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
            ))}
            {filters.country && (
              <Badge variant="outline" className="text-xs">{filters.country}</Badge>
            )}
            {filters.gender && (
              <Badge variant="outline" className="text-xs capitalize">{filters.gender}</Badge>
            )}
          </div>
        )}

        {isExpanded && drafts.length > 0 && (
          <div className="pt-2 border-t space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Recent Drafts</p>
            {drafts.slice(0, 3).map(draft => (
              <div key={draft.id} className="text-xs flex items-center justify-between">
                <span className="truncate">{draft.subject}</span>
                <span className="text-muted-foreground">
                  {format(new Date(draft.created_at), "d MMM")}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
