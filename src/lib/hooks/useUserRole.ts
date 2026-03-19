import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export function useUserRole() {
  const { user } = useAuth();

  const roleQuery = useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error) throw error;
      return (data?.role as 'admin' | 'user') || 'user';
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // Cache role for 5 minutes
  });

  return {
    role: roleQuery.data || 'user',
    isAdmin: roleQuery.data === 'admin',
    isLoading: roleQuery.isLoading,
  };
}
