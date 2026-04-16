import { useEffect } from 'react';
import useAuthStore from '@/stores/authStore';

export default function useAuth() {
  const { user, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return { user, isLoading };
}
