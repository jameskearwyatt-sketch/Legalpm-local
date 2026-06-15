export function useUserRole() {
  return {
    role: 'admin' as const,
    isAdmin: true,
    isLoading: false,
  };
}
