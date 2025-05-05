import { queryClient } from "@/lib/queryClient";
import { AuthUser } from "./FirebaseAuthService";

// Token storage
const TOKEN_KEY = 'mina_auth_token';

/**
 * Service that handles communication with our backend API
 * specifically for authentication and tokens
 */
export class ApiService {
  private static token: string | null = localStorage.getItem(TOKEN_KEY);
  
  /**
   * Verify Firebase authentication with our backend
   * This exchanges a Firebase user for our own JWT token
   */
  static async verifyAuth(firebaseUser: AuthUser): Promise<{ token: string, user: any }> {
    try {
      // Use our improved apiRequest function from queryClient
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || 'Failed to verify authentication with backend';
        } catch (e) {
          errorMessage = errorText || 'Failed to verify authentication with backend';
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Store token
      this.setToken(data.token);
      
      console.log('Successfully verified authentication with backend');
      return data;
    } catch (error) {
      console.error('Auth verification error:', error);
      throw error;
    }
  }
  
  /**
   * Get the authorization headers for API requests
   */
  static getAuthHeaders(): Record<string, string> {
    return this.token 
      ? { 'Authorization': `Bearer ${this.token}` }
      : {};
  }
  
  /**
   * Set the authentication token
   */
  static setToken(token: string | null): void {
    this.token = token;
    
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    
    // Update query client auth headers
    this.updateAuthHeaders();
  }
  
  /**
   * Clear the authentication token (on logout)
   */
  static clearToken(): void {
    this.setToken(null);
  }
  
  /**
   * Update the query client with the current auth headers
   */
  static updateAuthHeaders(): void {
    // Add Authorization header to all future queries
    queryClient.setDefaultOptions({
      queries: {
        meta: {
          headers: this.getAuthHeaders(),
        },
      },
      mutations: {
        meta: {
          headers: this.getAuthHeaders(),
        },
      },
    });
  }

  /**
   * Make an authenticated request to the API
   */
  static async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE', 
    url: string, 
    body?: any
  ): Promise<T> {
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      };
      
      const options: RequestInit = {
        method,
        headers,
      };
      
      if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
      }
      
      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API ${method} request to ${url} failed:`, error);
      throw error;
    }
  }
}

// Initialize query client with existing token on app load
if (ApiService.getAuthHeaders().Authorization) {
  ApiService.updateAuthHeaders();
}

export default ApiService;