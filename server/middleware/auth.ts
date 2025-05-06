import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { storage } from '../storage';

// Environment variable for JWT secret (should be properly set up in production)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-replace-in-production';

// Interface for decoded JWT token
interface DecodedToken {
  uid: string;
  email: string;
  displayName?: string;
  iat: number;
  exp: number;
}

// Extended Express Request with optional user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email: string;
        displayName?: string;
      };
      userId?: number;
    }
  }
}

/**
 * Middleware to verify JWT token from Authorization header
 * This is non-blocking - it will set req.user if token is valid but won't block
 * the request if there's no token or it's invalid
 */
export const authenticateOptional = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      
      if (token) {
        try {
          // Verify the token
          const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
          
          // Set user info on request
          req.user = {
            uid: decoded.uid,
            email: decoded.email,
            displayName: decoded.displayName
          };
          
          // Try to find or create the internal user ID
          const dbUser = await storage.getUserByFirebaseId(decoded.uid);
          if (dbUser) {
            req.userId = dbUser.id;
          } else {
            // Create user record if it doesn't exist
            const newUser = await storage.createUser({
              firebase_uid: decoded.uid,
              email: decoded.email,
              username: decoded.displayName || decoded.email.split('@')[0],
              avatar_url: null,
              password: '', // Not needed with Firebase auth
            });
            req.userId = newUser.id;
          }
        } catch (error) {
          // Invalid token, but we won't block the request
          console.warn('Invalid auth token:', error);
        }
      }
    }
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    next();
  }
};

/**
 * Middleware to require authentication
 * This will block the request with a 401 if there's no valid token
 */
export const authenticateRequired = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('Auth check - Headers:', req.headers);
    
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Auth check - No authorization header or invalid format');
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const token = authHeader.split(' ')[1];
    if (!token) {
      console.log('Auth check - No token found in header');
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    try {
      // Verify the token
      console.log('Auth check - Verifying token:', token.substring(0, 10) + '...');
      const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
      console.log('Auth check - Token valid, UID:', decoded.uid);
      
      // Set user info on request
      req.user = {
        uid: decoded.uid,
        email: decoded.email,
        displayName: decoded.displayName
      };
      
      // Try to find or create the internal user ID
      const dbUser = await storage.getUserByFirebaseId(decoded.uid);
      if (dbUser) {
        console.log('Auth check - Found existing user, ID:', dbUser.id);
        req.userId = dbUser.id;
      } else {
        console.log('Auth check - Creating new user for UID:', decoded.uid);
        // Create user record if it doesn't exist
        const newUser = await storage.createUser({
          firebase_uid: decoded.uid,
          email: decoded.email,
          username: decoded.displayName || decoded.email.split('@')[0],
          avatar_url: null,
          password: '', // Not needed with Firebase auth
        });
        req.userId = newUser.id;
        console.log('Auth check - Created user with ID:', newUser.id);
      }
      
      next();
    } catch (error) {
      console.log('Auth check - Token verification failed:', error.message);
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ message: 'Authentication failed' });
  }
};

/**
 * Generate a JWT token for a user
 */
export const generateToken = (user: { uid: string; email: string; displayName?: string }): string => {
  return jwt.sign(
    {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
    },
    JWT_SECRET,
    { expiresIn: '7d' } // Token expires in 7 days
  );
};