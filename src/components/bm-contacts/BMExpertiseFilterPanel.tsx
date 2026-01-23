import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X } from "lucide-react";
import { EXPERTISE_CATEGORIES } from "@/lib/bmExpertiseConfig";

interface BMExpertiseFilterPanelProps {
  selected: string[];
  onChange: (selected: string[]) => void;
  onClose: () => void;
}

export function BMExpertiseFilterPanel({
  selected,
  onChange,
  onClose,
}: BMExpertiseFilterPanelProps) {
  const [activeTab, setActiveTab] = useState<string>(EXPERTISE_CATEGORIES[0].key);

  const toggleExpertise = (path: string) => {
    if (selected.includes(path)) {
      onChange(selected.filter(s => s !== path));
    } else {
      onChange([...selected, path]);
    }
  };

  const clearCategory = (categoryKey: string) => {
    onChange(selected.filter(s => !s.startsWith(categoryKey + '.')));
  };

  const selectAllInSection = (categoryKey: string, sectionFields: { key: string }[]) => {
    const paths = sectionFields.map(f => `${categoryKey}.${f.key}`);
    const newSelected = new Set([...selected, ...paths]);
    onChange(Array.from(newSelected));
  };

  return (
    <div className="border rounded-lg bg-background">
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <span className="font-medium">Filter by Expertise</span>
          {selected.length > 0 && (
            <Badge variant="secondary">{selected.length} selected</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selected.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => onChange([])}>
              Clear All
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
          {EXPERTISE_CATEGORIES.map((category) => {
            const categorySelected = selected.filter(s => s.startsWith(category.key + '.')).length;
            return (
              <TabsTrigger
                key={category.key}
                value={category.key}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                {category.label}
                {categorySelected > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {categorySelected}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {EXPERTISE_CATEGORIES.map((category) => (
          <TabsContent key={category.key} value={category.key} className="m-0">
            <ScrollArea className="h-[300px]">
              <div className="p-4 space-y-4">
                {category.sections.map((section) => (
                  <div key={section.key}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                        {section.label}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => selectAllInSection(category.key, section.fields)}
                      >
                        Select all
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {section.fields.map((field) => {
                        const path = `${category.key}.${field.key}`;
                        const isSelected = selected.includes(path);
                        return (
                          <label
                            key={field.key}
                            className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                              isSelected 
                                ? section.color 
                                : 'hover:bg-muted'
                            }`}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleExpertise(path)}
                            />
                            <span className="text-sm">{field.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
