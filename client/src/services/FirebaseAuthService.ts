import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile
} from 'firebase/auth';
import { toast } from '@/hooks/use-toast';

// TODO: Replace with your Firebase config when available
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'PLACEHOLDER_API_KEY',
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID || 'your-project-id'}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'your-project-id',
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID || 'your-project-id'}.appspot.com`,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'PLACEHOLDER_APP_ID'
};

// Initialize Firebase
// Note: This will throw an error with placeholder values, but the app will still load
// Replace the placeholder values with your actual Firebase config values before deployment
let app: any;
let auth: any;
let googleProvider: any;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
  
  // Log initialization success
  console.log('Firebase initialized successfully');
} catch (error) {
  console.warn('Firebase initialization skipped - credentials needed:', error);
  console.info('⚠️ IMPORTANT: Replace placeholder Firebase values in FirebaseAuthService.ts before deploying');
}

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

class FirebaseAuthService {
  // Current user conversion from Firebase user to our simpler AuthUser type
  convertUser(user: FirebaseUser | null): AuthUser | null {
    if (!user) return null;
    
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL
    };
  }
  
  // Check if authentication is available
  isAuthAvailable(): boolean {
    return !!auth && !!app;
  }
  
  // Email sign-in
  async signInWithEmail(email: string, password: string): Promise<AuthUser | null> {
    if (!this.isAuthAvailable()) {
      throw new Error('Authentication not available - check Firebase configuration');
    }
    
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return this.convertUser(result.user);
    } catch (error: any) {
      console.error('Email sign-in error:', error);
      toast({
        title: 'Login Failed',
        description: this.getAuthErrorMessage(error),
        variant: 'destructive',
      });
      throw error;
    }
  }
  
  // Create account with email
  async createAccount(email: string, password: string, displayName: string): Promise<AuthUser | null> {
    if (!this.isAuthAvailable()) {
      throw new Error('Authentication not available - check Firebase configuration');
    }
    
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      // Set the display name
      if (displayName) {
        await updateProfile(result.user, { displayName });
      }
      
      return this.convertUser(result.user);
    } catch (error: any) {
      console.error('Create account error:', error);
      toast({
        title: 'Registration Failed',
        description: this.getAuthErrorMessage(error),
        variant: 'destructive',
      });
      throw error;
    }
  }
  
  // Google sign-in
  async signInWithGoogle(): Promise<AuthUser | null> {
    if (!this.isAuthAvailable()) {
      throw new Error('Authentication not available - check Firebase configuration');
    }
    
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return this.convertUser(result.user);
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      // Don't show toast for popup closed by user
      if (error.code !== 'auth/popup-closed-by-user') {
        toast({
          title: 'Google Login Failed',
          description: this.getAuthErrorMessage(error),
          variant: 'destructive',
        });
      }
      throw error;
    }
  }
  
  // Sign out
  async signOut(): Promise<void> {
    if (!this.isAuthAvailable()) {
      throw new Error('Authentication not available - check Firebase configuration');
    }
    
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
      toast({
        title: 'Sign Out Failed',
        description: 'Failed to sign out properly',
        variant: 'destructive',
      });
      throw error;
    }
  }
  
  // Get current user
  getCurrentUser(): Promise<AuthUser | null> {
    return new Promise((resolve) => {
      if (!this.isAuthAvailable()) {
        console.warn('Auth not available, returning null user');
        resolve(null);
        return;
      }
      
      const unsubscribe = onAuthStateChanged(auth, (user: FirebaseUser | null) => {
        unsubscribe();
        resolve(this.convertUser(user));
      });
    });
  }
  
  // Subscribe to auth state changes
  onAuthStateChanged(callback: (user: AuthUser | null) => void): () => void {
    if (!this.isAuthAvailable()) {
      console.warn('Auth not available, auth state changes will not be monitored');
      // Return a no-op unsubscribe function
      return () => {};
    }
    
    const unsubscribe = onAuthStateChanged(auth, (user: FirebaseUser | null) => {
      callback(this.convertUser(user));
    });
    
    return unsubscribe;
  }
  
  // Helper to get readable error messages
  private getAuthErrorMessage(error: any): string {
    const errorMap: Record<string, string> = {
      'auth/invalid-credential': 'Invalid email or password',
      'auth/user-not-found': 'User not found',
      'auth/wrong-password': 'Incorrect password',
      'auth/email-already-in-use': 'Email already in use',
      'auth/weak-password': 'Password is too weak',
      'auth/invalid-email': 'Invalid email format',
      'auth/account-exists-with-different-credential': 'Account already exists with a different sign-in method',
      'auth/popup-closed-by-user': 'Sign-in was cancelled',
      'auth/operation-not-allowed': 'This sign-in method is not enabled',
      'auth/network-request-failed': 'Network error, please check your connection'
    };
    
    return errorMap[error.code] || error.message || 'An unknown error occurred';
  }
}

export const authService = new FirebaseAuthService();
export default authService;