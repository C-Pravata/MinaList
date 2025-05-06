import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import authService, { AuthUser } from '@/services/FirebaseAuthService';
import ApiService from '@/services/ApiService';
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
  // Direct login with demo user
  signInWithDemo: (username: string, password: string) => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { toast } = useToast();

  // Helper function to verify auth with our backend
  const verifyAuthWithBackend = async (firebaseUser: AuthUser) => {
    try {
      // Verify with our backend to get JWT token
      await ApiService.verifyAuth(firebaseUser);
          
      // Refresh data after authentication
      queryClient.invalidateQueries({ queryKey: ['/api/notes'] });
      return true;
    } catch (error) {
      console.error('Failed to authenticate with backend:', error);
      toast({
        title: 'Authentication error',
        description: 'There was a problem connecting to the server. Some features may not work.',
        variant: 'destructive',
      });
      return false;
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check for existing redirect result (from Google sign-in)
        const redirectUser = await authService.processRedirectResult();
        if (redirectUser) {
          // If we got a user from redirect, use it and verify with backend
          setUser(redirectUser);
          await verifyAuthWithBackend(redirectUser);
        } else {
          // Otherwise check current user
          const currentUser = await authService.getCurrentUser();
          if (currentUser) {
            setUser(currentUser);
            // Try to verify any persistent user
            await verifyAuthWithBackend(currentUser);
          }
        }
      } catch (error) {
        console.error('Error initializing authentication:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Subscribe to auth state changes
    const unsubscribe = authService.onAuthStateChanged(async (updatedUser) => {
      // User status changed
      const prevUser = user;
      setUser(updatedUser);
      
      // If user signed in (and wasn't signed in before)
      if (updatedUser && (!prevUser || prevUser.uid !== updatedUser.uid)) {
        await verifyAuthWithBackend(updatedUser);
      } else if (!updatedUser && prevUser) {
        // User signed out
        ApiService.clearToken();
      }
    });

    return () => unsubscribe();
  }, []);

  // Sign in with email and password
  const signInWithEmail = async (email: string, password: string) => {
    try {
      const user = await authService.signInWithEmail(email, password);
      if (user) {
        toast({
          title: 'Welcome back!',
          description: user.displayName ? `Signed in as ${user.displayName}` : 'Successfully signed in',
        });
      }
      return user;
    } catch (error: any) {
      toast({
        title: 'Sign-in failed',
        description: error.message || 'Please check your credentials and try again',
        variant: 'destructive',
      });
      return null;
    }
  };

  // Create a new account with email and password
  const createAccount = async (email: string, password: string, displayName: string) => {
    try {
      const user = await authService.createAccount(email, password, displayName);
      if (user) {
        toast({
          title: 'Account created!',
          description: 'Welcome to Mina Notes',
        });
      }
      return user;
    } catch (error: any) {
      toast({
        title: 'Registration failed',
        description: error.message || 'Please try again with different credentials',
        variant: 'destructive',
      });
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
    } catch (error: any) {
      if (error.message) {
        toast({
          title: 'Google Sign-in failed',
          description: error.message,
          variant: 'destructive',
        });
      }
      return null;
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      await authService.signOut();
      // Clear backend token
      ApiService.clearToken();
      // Clear all queries from cache when user logs out
      queryClient.clear();
      toast({
        title: 'Signed out',
        description: 'You have been successfully signed out',
      });
    } catch (error: any) {
      console.error('Sign out error:', error);
      toast({
        title: 'Sign out error',
        description: error.message || 'There was a problem signing out',
        variant: 'destructive',
      });
    }
  };

  // Direct login using the backend (bypassing Firebase) for demo user
  const signInWithDemo = async (username: string, password: string) => {
    try {
      setIsLoading(true);
      
      // Make direct call to our backend login endpoint
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Login failed');
      }

      // Get token and user data
      const data = await response.json();
      
      // Store the token for future requests
      ApiService.setToken(data.token);
      
      // Create a mock AuthUser from the demo user data
      const demoUser: AuthUser = {
        uid: data.user.uid || 'demo-user',
        email: data.user.email || 'demo@example.com',
        displayName: data.user.displayName || 'Demo User',
        photoURL: null,
        isAnonymous: false,
        metadata: {
          creationTime: new Date().toISOString(),
          lastSignInTime: new Date().toISOString(),
        },
        providerData: []
      };
      
      // Update the user state
      setUser(demoUser);
      
      // CRITICAL: Make sure the queryClient has the auth headers before making any requests
      ApiService.updateAuthHeaders();
      
      // Refresh data after authentication
      queryClient.invalidateQueries({ queryKey: ['/api/notes'] });
      
      toast({
        title: 'Demo Login Successful',
        description: 'Welcome to Mina Notes!',
      });
      
      return demoUser;
    } catch (error: any) {
      console.error('Demo login error:', error);
      toast({
        title: 'Demo login failed',
        description: error.message || 'Please check your credentials and try again',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
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
    signInWithDemo,
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