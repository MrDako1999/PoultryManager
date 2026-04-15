import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '@/stores/authStore';

export default function useAuth({ redirect = true } = {}) {
  const { user, isLoading, checkAuth } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isLoading && !user && redirect) {
      navigate('/login');
    }
  }, [isLoading, user, redirect, navigate]);

  return { user, isLoading };
}
