import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useClients, Client, CreateClientInput } from '@/lib/hooks/useClients';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
import { toast } from 'sonner';

const clientSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  group_sector: z.string().max(100).optional(),
  billing_contact: z.string().max(200).optional(),
});

interface ClientFormProps {
  client?: Client | null;
  onSuccess: () => void;
}

export function ClientForm({ client, onSuccess }: ClientFormProps) {
  const { createClient, updateClient } = useClients();
  const isEditing = !!client;

  const [formData, setFormData] = useState<CreateClientInput>({
    name: client?.name || '',
    group_sector: client?.group_sector || '',
    billing_contact: client?.billing_contact || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      const validated = clientSchema.parse(formData);
      setIsSubmitting(true);

      if (isEditing) {
        await updateClient.mutateAsync({ id: client.id, ...validated });
        toast.success('Client updated');
      } else {
        await createClient.mutateAsync({ name: validated.name, group_sector: validated.group_sector, billing_contact: validated.billing_contact });
        toast.success('Client created');
      }
      onSuccess();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(fieldErrors);
        toast.error('Please correct the highlighted fields');
      } else {
        const message = error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.';
        setErrors({ name: message });
        toast.error(isEditing ? 'Failed to update client' : 'Failed to create client', { description: message });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (field: keyof CreateClientInput, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => updateField('name', e.target.value)}
          placeholder="Client organisation name"
          className={errors.name ? 'border-destructive' : ''}
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="group_sector">Group / Sector</Label>
        <Input
          id="group_sector"
          value={formData.group_sector}
          onChange={(e) => updateField('group_sector', e.target.value)}
          placeholder="e.g., Financial Services, Healthcare"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="billing_contact">Billing Contact</Label>
        <Input
          id="billing_contact"
          value={formData.billing_contact}
          onChange={(e) => updateField('billing_contact', e.target.value)}
          placeholder="Primary billing contact name or email"
        />
      </div>

      <div className="flex gap-3 justify-end pt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isEditing ? 'Saving...' : 'Creating...'}
            </>
          ) : isEditing ? (
            'Save Changes'
          ) : (
            'Create Client'
          )}
        </Button>
      </div>
    </form>
  );
}
