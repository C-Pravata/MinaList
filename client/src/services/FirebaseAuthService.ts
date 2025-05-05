import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile,
  Auth,
  AuthError
} from 'firebase/auth';
import { auth, googleProvider } from '@/firebase/config';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

class FirebaseAuthService {
  private redirectResultProcessed = false;
  private auth: Auth;
  
  constructor() {
    this.auth = auth;
  }
  
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
    return !!this.auth;
  }
  
  // Process any pending redirect result on app start
  async processRedirectResult(): Promise<AuthUser | null> {
    if (this.redirectResultProcessed) {
      return null;
    }
    
    this.redirectResultProcessed = true;
    
    try {
      const result = await getRedirectResult(this.auth);
      if (result) {
        console.log('Processed redirect result:', result.user);
        return this.convertUser(result.user);
      }
      return null;
    } catch (error) {
      console.error('Error processing redirect result:', error);
      return null;
    }
  }
  
  // Email sign-in
  async signInWithEmail(email: string, password: string): Promise<AuthUser | null> {
    if (!this.isAuthAvailable()) {
      throw new Error('Authentication not available - check Firebase configuration');
    }
    
    try {
      const result = await signInWithEmailAndPassword(this.auth, email, password);
      return this.convertUser(result.user);
    } catch (error: any) {
      console.error('Email sign-in error:', error);
      throw new Error(this.getAuthErrorMessage(error));
    }
  }
  
  // Create account with email
  async createAccount(email: string, password: string, displayName: string): Promise<AuthUser | null> {
    if (!this.isAuthAvailable()) {
      throw new Error('Authentication not available - check Firebase configuration');
    }
    
    try {
      const result = await createUserWithEmailAndPassword(this.auth, email, password);
      
      // Set the display name
      if (displayName) {
        await updateProfile(result.user, { displayName });
      }
      
      return this.convertUser(result.user);
    } catch (error: any) {
      console.error('Create account error:', error);
      throw new Error(this.getAuthErrorMessage(error));
    }
  }
  
  // Google sign-in with popup (better for iframe environments like Replit)
  async signInWithGoogle(): Promise<AuthUser | null> {
    if (!this.isAuthAvailable()) {
      throw new Error('Authentication not available - check Firebase configuration');
    }
    
    try {
      // Use popup instead of redirect for better compatibility in Replit
      const result = await signInWithPopup(this.auth, googleProvider);
      return this.convertUser(result.user);
    } catch (error: any) {
      // Don't throw for user cancellations
      if (error.code === 'auth/popup-closed-by-user') {
        console.log('User closed the popup');
        return null;
      }
      
      console.error('Google sign-in error:', error);
      throw new Error(this.getAuthErrorMessage(error));
    }
  }
  
  // Sign out
  async signOut(): Promise<void> {
    if (!this.isAuthAvailable()) {
      throw new Error('Authentication not available - check Firebase configuration');
    }
    
    try {
      await firebaseSignOut(this.auth);
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
      
      const unsubscribe = onAuthStateChanged(this.auth, (user: FirebaseUser | null) => {
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
    
    const unsubscribe = onAuthStateChanged(this.auth, (user: FirebaseUser | null) => {
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
      'auth/network-request-failed': 'Network error, please check your connection',
      'auth/popup-blocked': 'The sign-in popup was blocked by your browser. Please allow popups for this site.',
      'auth/unauthorized-domain': 'This domain is not authorized for OAuth operations. Please add it to your Firebase authorized domains.'
    };
    
    return errorMap[error.code] || error.message || 'An unknown error occurred';
  }
}

export const authService = new FirebaseAuthService();
export default authService;