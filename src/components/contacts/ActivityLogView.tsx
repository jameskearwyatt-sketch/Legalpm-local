import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDistributionActivityLog } from "@/lib/hooks/useDistributionActivityLog";
import { History, Mail, FolderOpen, Download, Upload, UserPlus } from "lucide-react";

const activityIcons: Record<string, React.ReactNode> = {
  email_draft_created: <Mail className="h-4 w-4" />,
  campaign_created: <FolderOpen className="h-4 w-4" />,
  export_generated: <Download className="h-4 w-4" />,
  import_completed: <Upload className="h-4 w-4" />,
  contact_created: <UserPlus className="h-4 w-4" />,
};

const activityColors: Record<string, string> = {
  email_draft_created: "bg-blue-100 text-blue-700",
  campaign_created: "bg-purple-100 text-purple-700",
  export_generated: "bg-green-100 text-green-700",
  import_completed: "bg-amber-100 text-amber-700",
  contact_created: "bg-teal-100 text-teal-700",
};

export function ActivityLogView() {
  const { data: activities = [], isLoading } = useDistributionActivityLog(100);

  return (
    <div className="max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Activity Log
          </CardTitle>
          <CardDescription>
            Automatic log of email drafts, campaigns, and exports created in this app
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading activity...</p>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No activity recorded yet.</p>
              <p className="text-sm">Actions like creating email drafts will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 pb-4 border-b last:border-0 last:pb-0"
                >
                  <div className={`p-2 rounded-full ${activityColors[activity.activity_type] || "bg-muted"}`}>
                    {activityIcons[activity.activity_type] || <History className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{activity.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(activity.created_at), "d MMM yyyy 'at' HH:mm")}
                    </p>
                    {activity.metadata && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(activity.metadata as Record<string, unknown>).recipient_count && (
                          <Badge variant="outline" className="text-xs">
                            {String((activity.metadata as Record<string, unknown>).recipient_count)} recipients
                          </Badge>
                        )}
                        {(activity.metadata as Record<string, unknown>).count && (
                          <Badge variant="outline" className="text-xs">
                            {String((activity.metadata as Record<string, unknown>).count)} contacts
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
