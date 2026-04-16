import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export function useUserRole() {
  const { user } = useAuth();

  const roleQuery = useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      // A user may legitimately have multiple role rows (e.g. both 'user' and 'admin').
      // Select all of them and derive the effective role client-side — .maybeSingle()
      // would throw when more than one row matches.
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user!.id);

      if (error) throw error;
      const roles = (data ?? []).map((r) => r.role as 'admin' | 'user');
      return roles.includes('admin') ? 'admin' : 'user';
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // Cache role for 5 minutes
  });

  return {
    role: roleQuery.data ?? 'user',
    isAdmin: roleQuery.data === 'admin',
    isLoading: roleQuery.isLoading,
  };
}
