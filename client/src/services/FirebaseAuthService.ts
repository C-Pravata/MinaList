import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile
} from 'firebase/auth';
import { auth, googleProvider } from '@/firebase/config';

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
    return true; // We already verified Firebase config is available
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