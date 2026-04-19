import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useCallback } from 'react';

export interface Notification {
  id: string;
  user_id: string;
  alert_type: string;
  matter_id: string | null;
  matter_name: string | null;
  matter_number: string | null;
  client_name: string | null;
  message: string;
  is_read: boolean;
  read_at: string | null;
  snoozed_until: string | null;
  created_at: string;
}

interface AlertLike {
  type: string;
  matterId: string;
  matterName: string;
  matterNumber?: string;
  clientName?: string;
  message: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('notifications' as never)
        .select('*')
        .eq('user_id', user!.id)
        .or(`snoozed_until.is.null,snoozed_until.lt.${now}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as unknown as Notification[];
    },
    enabled: !!user,
    staleTime: 30 * 1000,
  });

  const notifications = notificationsQuery.data || [];
  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notifications' as never)
        .update({ is_read: true, read_at: new Date().toISOString() } as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications' as never)
        .update({ is_read: true, read_at: new Date().toISOString() } as never)
        .eq('user_id', user!.id)
        .eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const snoozeNotification = useMutation({
    mutationFn: async ({ id, days }: { id: string; days: number }) => {
      const until = new Date();
      until.setDate(until.getDate() + days);
      const { error } = await supabase
        .from('notifications' as never)
        .update({ snoozed_until: until.toISOString() } as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const deleteNotification = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notifications' as never)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const syncAlerts = useCallback(async (alerts: AlertLike[], pipelineAlerts: AlertLike[]) => {
    if (!user) return;

    const allAlerts = [...alerts, ...pipelineAlerts];
    if (allAlerts.length === 0) return;

    const { data: existing } = await supabase
      .from('notifications' as never)
      .select('alert_type, matter_id')
      .eq('user_id', user.id);

    const existingKeys = new Set(
      ((existing || []) as Array<{ alert_type: string; matter_id: string }>)
        .map(e => `${e.alert_type}::${e.matter_id}`)
    );

    const newAlerts = allAlerts.filter(
      a => !existingKeys.has(`${a.type}::${a.matterId}`)
    );

    if (newAlerts.length === 0) return;

    const rows = newAlerts.map(a => ({
      user_id: user.id,
      alert_type: a.type,
      matter_id: a.matterId,
      matter_name: a.matterName,
      matter_number: a.matterNumber || null,
      client_name: a.clientName || null,
      message: a.message,
    }));

    await supabase
      .from('notifications' as never)
      .insert(rows as never);

    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }, [user, queryClient]);

  return {
    notifications,
    unreadCount,
    isLoading: notificationsQuery.isLoading,
    markAsRead,
    markAllAsRead,
    snoozeNotification,
    deleteNotification,
    syncAlerts,
  };
}
