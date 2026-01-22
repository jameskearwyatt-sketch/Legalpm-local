import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContactsListView } from "@/components/contacts/ContactsListView";
import { CampaignsView } from "@/components/contacts/CampaignsView";
import { SectorManagement } from "@/components/contacts/SectorManagement";
import { ActivityLogView } from "@/components/contacts/ActivityLogView";
import { Users, FolderOpen, Tags, History } from "lucide-react";

export default function Contacts() {
  const [activeTab, setActiveTab] = useState("contacts");

  return (
    <AppLayout>
      <div className="p-6 max-w-[1600px] mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-heading font-bold text-foreground">
            Contacts Distribution Hub
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage professional contacts for event invitations, thought leadership, and firm updates
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="contacts" className="gap-2">
              <Users className="h-4 w-4" />
              Contacts
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="gap-2">
              <FolderOpen className="h-4 w-4" />
              Campaigns
            </TabsTrigger>
            <TabsTrigger value="sectors" className="gap-2">
              <Tags className="h-4 w-4" />
              Sectors
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2">
              <History className="h-4 w-4" />
              Activity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contacts" className="mt-0">
            <ContactsListView />
          </TabsContent>

          <TabsContent value="campaigns" className="mt-0">
            <CampaignsView />
          </TabsContent>

          <TabsContent value="sectors" className="mt-0">
            <SectorManagement />
          </TabsContent>

          <TabsContent value="activity" className="mt-0">
            <ActivityLogView />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
