import { useSupabaseAuth } from '@/contexts/AuthContext'

export function useAuth() {
  const { user, loading, signIn, signUp, signOut, getAccessToken } = useSupabaseAuth()

  return {
    user,
    isLoading: loading,
    isAuthenticated: !!user,
    signIn,
    signUp,
    signOut,
    getAccessToken,
  }
}
