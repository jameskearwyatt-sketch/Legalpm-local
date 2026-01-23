import { TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EXPERTISE_CATEGORIES } from "@/lib/bmExpertiseConfig";
import { type BMInternalContact, type BMInternalContactExpertise } from "@/lib/hooks/useBMInternalContacts";

interface BMContactDetailRowProps {
  contact: BMInternalContact;
}

export function BMContactDetailRow({ contact }: BMContactDetailRowProps) {
  const expertise = contact.expertise;

  const getExpertiseForCategory = (categoryKey: 'project_development' | 'ma' | 'project_finance') => {
    const categoryConfig = EXPERTISE_CATEGORIES.find(c => c.key === categoryKey);
    if (!categoryConfig) return [];

    const categoryExpertise = expertise[categoryKey];
    if (!categoryExpertise || typeof categoryExpertise !== 'object') return [];

    const results: { section: string; color: string; fields: string[] }[] = [];

    for (const section of categoryConfig.sections) {
      const activeFields = section.fields
        .filter(field => categoryExpertise[field.key as keyof typeof categoryExpertise] === true)
        .map(field => field.label);

      if (activeFields.length > 0) {
        results.push({
          section: section.label,
          color: section.color,
          fields: activeFields,
        });
      }
    }

    return results;
  };

  const projectDev = getExpertiseForCategory('project_development');
  const ma = getExpertiseForCategory('ma');
  const projectFinance = getExpertiseForCategory('project_finance');

  const hasAnyExpertise = projectDev.length > 0 || ma.length > 0 || projectFinance.length > 0;

  return (
    <TableRow className="bg-muted/30">
      <TableCell colSpan={8} className="p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Project Development */}
          <div>
            <h4 className="font-semibold text-sm mb-3 text-primary">Project Development</h4>
            {projectDev.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No expertise listed</p>
            ) : (
              <div className="space-y-2">
                {projectDev.map((section) => (
                  <div key={section.section}>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {section.section}
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {section.fields.map((field) => (
                        <Badge key={field} className={section.color} variant="secondary">
                          {field}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* M&A */}
          <div>
            <h4 className="font-semibold text-sm mb-3 text-primary">M&A</h4>
            {ma.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No expertise listed</p>
            ) : (
              <div className="space-y-2">
                {ma.map((section) => (
                  <div key={section.section}>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {section.section}
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {section.fields.map((field) => (
                        <Badge key={field} className={section.color} variant="secondary">
                          {field}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Project Finance */}
          <div>
            <h4 className="font-semibold text-sm mb-3 text-primary">Project Finance</h4>
            {projectFinance.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No expertise listed</p>
            ) : (
              <div className="space-y-2">
                {projectFinance.map((section) => (
                  <div key={section.section}>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {section.section}
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {section.fields.map((field) => (
                        <Badge key={field} className={section.color} variant="secondary">
                          {field}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {!hasAnyExpertise && (
          <p className="text-sm text-muted-foreground italic text-center py-4">
            No expertise information available for this contact
          </p>
        )}
      </TableCell>
    </TableRow>
  );
}
