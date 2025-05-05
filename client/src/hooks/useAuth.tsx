import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import authService, { AuthUser } from '@/services/FirebaseAuthService';
import apiService from '@/services/ApiService';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signInWithEmail: (email: string, password: string) => Promise<AuthUser | null>;
  createAccount: (email: string, password: string, displayName: string) => Promise<AuthUser | null>;
  signInWithGoogle: () => Promise<AuthUser | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { toast } = useToast();

  useEffect(() => {
    const initAuth = async () => {
      try {
        // First process any redirect result (for Google sign-in)
        const redirectUser = await authService.processRedirectResult();
        if (redirectUser) {
          // If we got a user from redirect, use it and verify with backend
          setUser(redirectUser);
          try {
            await apiService.verifyAuth(redirectUser);
            queryClient.invalidateQueries({ queryKey: ['/api/notes'] });
          } catch (error) {
            console.error('Failed to authenticate redirect user with backend:', error);
          }
        } else {
          // Otherwise check current user
          const currentUser = await authService.getCurrentUser();
          setUser(currentUser);
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Subscribe to auth state changes
    const unsubscribe = authService.onAuthStateChanged(async (updatedUser) => {
      setUser(updatedUser);
      
      // Authenticate with our backend when user signs in
      if (updatedUser) {
        try {
          // Verify with our backend to get JWT token
          await apiService.verifyAuth(updatedUser);
          
          // Refresh data after authentication
          queryClient.invalidateQueries({ queryKey: ['/api/notes'] });
        } catch (error) {
          console.error('Failed to authenticate with backend:', error);
          toast({
            title: 'Authentication error',
            description: 'There was a problem connecting to the server. Some features may not work.',
            variant: 'destructive',
          });
        }
      } else {
        // Clear token on sign out
        apiService.clearToken();
      }
    });

    return () => unsubscribe();
  }, []);

  // Sign in with email and password
  const signInWithEmail = async (email: string, password: string) => {
    try {
      const user = await authService.signInWithEmail(email, password);
      toast({
        title: 'Welcome back!',
        description: user?.displayName ? `Signed in as ${user.displayName}` : 'Successfully signed in',
      });
      return user;
    } catch (error) {
      // Error is already handled by authService
      return null;
    }
  };

  // Create a new account with email and password
  const createAccount = async (email: string, password: string, displayName: string) => {
    try {
      const user = await authService.createAccount(email, password, displayName);
      toast({
        title: 'Account created!',
        description: 'Welcome to Mina Notes',
      });
      return user;
    } catch (error) {
      // Error is already handled by authService
      return null;
    }
  };

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      const user = await authService.signInWithGoogle();
      if (user) {
        toast({
          title: 'Welcome!',
          description: user.displayName ? `Signed in as ${user.displayName}` : 'Successfully signed in with Google',
        });
      }
      return user;
    } catch (error) {
      // Only log error - no toast for popup being closed
      if ((error as any).code !== 'auth/popup-closed-by-user') {
        console.error('Google sign-in error:', error);
      }
      return null;
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      await authService.signOut();
      // Clear backend token
      apiService.clearToken();
      // Clear all queries from cache when user logs out
      queryClient.clear();
      toast({
        title: 'Signed out',
        description: 'You have been successfully signed out',
      });
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    signInWithEmail,
    createAccount,
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}