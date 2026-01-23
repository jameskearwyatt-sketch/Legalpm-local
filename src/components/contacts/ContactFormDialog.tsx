import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  useCreateDistributionContact,
  useUpdateDistributionContact,
  type DistributionContact,
} from "@/lib/hooks/useDistributionContacts";
import { useDistributionRelationshipOwners, useEnsureRelationshipOwner } from "@/lib/hooks/useDistributionRelationshipOwners";
import { COUNTRIES } from "@/lib/countries";
import { Check, ChevronsUpDown, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const contactSchema = z.object({
  full_name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  company: z.string().optional(),
  job_title: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  gender: z.enum(["male", "female", "unknown"]),
  emi_focus_areas: z.array(z.string()),
  linkedin_url: z.string().url().optional().or(z.literal("")),
  notes: z.string().optional(),
  relationship_owner: z.string().optional(),
  do_not_contact: z.boolean(),
  provenance: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactSchema>;

interface ContactFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: DistributionContact;
}

export function ContactFormDialog({ open, onOpenChange, contact }: ContactFormDialogProps) {
  const [countryOpen, setCountryOpen] = useState(false);
  const [sectorOpen, setSectorOpen] = useState(false);
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [ownerSearch, setOwnerSearch] = useState("");

  const createContact = useCreateDistributionContact();
  const updateContact = useUpdateDistributionContact();
  const { data: relationshipOwners = [] } = useDistributionRelationshipOwners();
  const ensureOwner = useEnsureRelationshipOwner();

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      full_name: "",
      email: "",
      company: "",
      job_title: "",
      country: "",
      city: "",
      gender: "unknown",
      emi_focus_areas: [],
      linkedin_url: "",
      notes: "",
      relationship_owner: "",
      do_not_contact: false,
      provenance: "",
    },
  });

  useEffect(() => {
    if (contact) {
      form.reset({
        full_name: contact.full_name,
        email: contact.email,
        company: contact.company || "",
        job_title: contact.job_title || "",
        country: contact.country || "",
        city: contact.city || "",
        gender: contact.gender,
        emi_focus_areas: contact.emi_focus_areas || [],
        linkedin_url: contact.linkedin_url || "",
        notes: contact.notes || "",
        relationship_owner: contact.relationship_owner || "",
        do_not_contact: contact.do_not_contact,
        provenance: contact.provenance || "",
      });
    } else {
      form.reset({
        full_name: "",
        email: "",
        company: "",
        job_title: "",
        country: "",
        city: "",
        gender: "unknown",
        emi_focus_areas: [],
        linkedin_url: "",
        notes: "",
        relationship_owner: "",
        do_not_contact: false,
        provenance: "Manual entry",
      });
    }
  }, [contact, form]);

  const onSubmit = async (data: ContactFormData) => {
    // Ensure relationship owner is saved for autocomplete
    if (data.relationship_owner) {
      await ensureOwner.mutateAsync(data.relationship_owner);
    }

    // Determine if EMI focus areas were manually changed
    const hadExistingFocusAreas = contact?.emi_focus_areas && contact.emi_focus_areas.length > 0;
    const focusAreasChanged = contact 
      ? JSON.stringify(data.emi_focus_areas.sort()) !== JSON.stringify((contact.emi_focus_areas || []).sort())
      : data.emi_focus_areas.length > 0;
    const markAsManualEdit = focusAreasChanged || contact?.emi_focus_areas_manual_edit;

    if (contact) {
      await updateContact.mutateAsync({
        id: contact.id,
        full_name: data.full_name,
        email: data.email,
        gender: data.gender,
        emi_focus_areas: data.emi_focus_areas,
        emi_focus_areas_manual_edit: markAsManualEdit ? true : false,
        emi_focus_areas_assigned_at: focusAreasChanged ? new Date().toISOString() : contact.emi_focus_areas_assigned_at,
        do_not_contact: data.do_not_contact,
        company: data.company || null,
        job_title: data.job_title || null,
        country: data.country || null,
        city: data.city || null,
        linkedin_url: data.linkedin_url || null,
        notes: data.notes || null,
        relationship_owner: data.relationship_owner || null,
        provenance: data.provenance || null,
      });
    } else {
      await createContact.mutateAsync({
        full_name: data.full_name,
        email: data.email,
        gender: data.gender,
        sectors: [],
        sectors_ai_assigned: false,
        emi_focus_areas: data.emi_focus_areas,
        emi_focus_areas_manual_edit: data.emi_focus_areas.length > 0,
        do_not_contact: data.do_not_contact,
        company: data.company || null,
        job_title: data.job_title || null,
        country: data.country || null,
        city: data.city || null,
        linkedin_url: data.linkedin_url || null,
        notes: data.notes || null,
        relationship_owner: data.relationship_owner || null,
        provenance: data.provenance || "Manual entry",
      });
    }

    onOpenChange(false);
  };

  const selectedFocusAreas = form.watch("emi_focus_areas");
  const [focusAreaInput, setFocusAreaInput] = useState("");

  const toggleFocusArea = (area: string) => {
    const current = form.getValues("emi_focus_areas");
    if (current.includes(area)) {
      form.setValue("emi_focus_areas", current.filter(a => a !== area));
    } else {
      form.setValue("emi_focus_areas", [...current, area]);
    }
  };

  const addCustomFocusArea = () => {
    const trimmed = focusAreaInput.trim();
    if (trimmed && !selectedFocusAreas.includes(trimmed)) {
      form.setValue("emi_focus_areas", [...selectedFocusAreas, trimmed]);
      setFocusAreaInput("");
    }
  };

  // Common EMI focus areas for suggestions
  const suggestedFocusAreas = [
    "Nuclear", "Oil & Gas", "Renewables", "Mining & Metals", "PPAs",
    "Hydrogen", "Wind", "Solar", "BESS", "Utilities & Grid",
    "Natural Gas", "Power Generation", "Water & Environment", "Infrastructure"
  ];

  const filteredSuggestions = suggestedFocusAreas.filter(area =>
    area.toLowerCase().includes(focusAreaInput.toLowerCase()) &&
    !selectedFocusAreas.includes(area)
  );

  const filteredOwners = relationshipOwners.filter(o => 
    o.name.toLowerCase().includes(ownerSearch.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {contact ? "Edit Contact" : "Add Contact"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="job_title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Title</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Country</FormLabel>
                    <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "justify-between",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value || "Select country"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0">
                        <Command>
                          <CommandInput placeholder="Search country..." />
                          <CommandList>
                            <CommandEmpty>No country found.</CommandEmpty>
                            <CommandGroup>
                              {COUNTRIES.map((country) => (
                                <CommandItem
                                  key={country.code}
                                  value={country.name}
                                  onSelect={() => {
                                    form.setValue("country", country.name);
                                    setCountryOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      country.name === field.value ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {country.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="unknown">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="emi_focus_areas"
              render={() => (
                <FormItem>
                  <FormLabel>EMI Focus Areas</FormLabel>
                  <div className="space-y-2">
                    {/* Selected focus areas */}
                    {selectedFocusAreas.length > 0 && (
                      <div className="flex flex-wrap gap-1 p-2 border rounded-md bg-muted/30">
                        {selectedFocusAreas.map(area => (
                          <Badge key={area} variant="secondary">
                            {area}
                            <button
                              type="button"
                              className="ml-1 hover:text-destructive"
                              onClick={() => toggleFocusArea(area)}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    
                    {/* Input for adding focus areas */}
                    <Popover open={sectorOpen} onOpenChange={setSectorOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between"
                            type="button"
                          >
                            <span className="text-muted-foreground">Add focus areas...</span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0">
                        <Command>
                          <CommandInput 
                            placeholder="Search or type custom..." 
                            value={focusAreaInput}
                            onValueChange={setFocusAreaInput}
                          />
                          <CommandList>
                            <CommandEmpty>
                              {focusAreaInput.trim() && (
                                <button
                                  type="button"
                                  className="w-full p-2 text-sm text-left hover:bg-accent flex items-center gap-2"
                                  onClick={() => {
                                    addCustomFocusArea();
                                    setSectorOpen(false);
                                  }}
                                >
                                  <Plus className="h-4 w-4" />
                                  Add "{focusAreaInput.trim()}"
                                </button>
                              )}
                              {!focusAreaInput.trim() && "Type to add custom focus area"}
                            </CommandEmpty>
                            <CommandGroup heading="Suggested">
                              {filteredSuggestions.map((area) => (
                                <CommandItem
                                  key={area}
                                  value={area}
                                  onSelect={() => {
                                    toggleFocusArea(area);
                                    setFocusAreaInput("");
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedFocusAreas.includes(area) ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {area}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="relationship_owner"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Relationship Owner</FormLabel>
                    <Popover open={ownerOpen} onOpenChange={setOwnerOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "justify-between",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value || "Select or type"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0">
                        <Command>
                          <CommandInput 
                            placeholder="Search or add..." 
                            value={ownerSearch}
                            onValueChange={setOwnerSearch}
                          />
                          <CommandList>
                            <CommandEmpty>
                              {ownerSearch && (
                                <button
                                  type="button"
                                  className="w-full p-2 text-sm text-left hover:bg-accent"
                                  onClick={() => {
                                    form.setValue("relationship_owner", ownerSearch);
                                    setOwnerOpen(false);
                                    setOwnerSearch("");
                                  }}
                                >
                                  Add "{ownerSearch}"
                                </button>
                              )}
                            </CommandEmpty>
                            <CommandGroup>
                              {filteredOwners.map((owner) => (
                                <CommandItem
                                  key={owner.id}
                                  value={owner.name}
                                  onSelect={() => {
                                    form.setValue("relationship_owner", owner.name);
                                    setOwnerOpen(false);
                                    setOwnerSearch("");
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      owner.name === field.value ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {owner.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="linkedin_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>LinkedIn URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://linkedin.com/in/..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="do_not_contact"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-3 space-y-0 rounded-lg border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="cursor-pointer">
                      Do Not Contact
                    </FormLabel>
                    <p className="text-sm text-muted-foreground">
                      This contact will be excluded from all email drafts
                    </p>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createContact.isPending || updateContact.isPending}>
                {contact ? "Save Changes" : "Add Contact"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
