// Mock Wix Authentication Service for local development
// In production, this will use Wix Members API

import type { UserSession, AdminSession, ApiResponse } from '../types';

// Mock user database
const mockUsers = new Map<string, { email: string; password: string; companyName: string; contactName: string }>();

// Mock admin credentials
const ADMIN_CREDENTIALS = {
  email: 'admin@mps.com',
  password: 'admin123',
  username: 'MPS Admin',
};

// Current session (in memory for mock)
let currentSession: UserSession | AdminSession | null = null;

// Register a new user
export const registerUser = async (
  email: string,
  password: string,
  companyName: string,
  contactName: string
): Promise<ApiResponse<UserSession>> => {
  try {
    if (mockUsers.has(email)) {
      return { success: false, error: 'User already exists' };
    }

    mockUsers.set(email, { email, password, companyName, contactName });

    const session: UserSession = {
      customerId: `user_${Date.now()}`,
      customerEmail: email,
      companyName,
      contactName,
      isAdmin: false,
    };

    currentSession = session;
    return { success: true, data: session };
  } catch (error) {
    return { success: false, error: 'Failed to register user' };
  }
};

// Login user
export const loginUser = async (
  email: string,
  password: string
): Promise<ApiResponse<UserSession | AdminSession>> => {
  try {
    // Check if admin
    if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
      const adminSession: AdminSession = {
        adminId: 'admin_1',
        adminEmail: ADMIN_CREDENTIALS.email,
        username: ADMIN_CREDENTIALS.username,
        isAdmin: true,
      };
      currentSession = adminSession;
      return { success: true, data: adminSession };
    }

    // Check if regular user
    const user = mockUsers.get(email);
    if (user && user.password === password) {
      const session: UserSession = {
        customerId: `user_${email}`,
        customerEmail: email,
        companyName: user.companyName,
        contactName: user.contactName,
        isAdmin: false,
      };
      currentSession = session;
      return { success: true, data: session };
    }

    return { success: false, error: 'Invalid email or password' };
  } catch (error) {
    return { success: false, error: 'Failed to login' };
  }
};

// Get current session
export const getCurrentSession = async (): Promise<ApiResponse<UserSession | AdminSession>> => {
  if (currentSession) {
    return { success: true, data: currentSession };
  }
  return { success: false, error: 'No active session' };
};

// Logout
export const logout = async (): Promise<ApiResponse<void>> => {
  currentSession = null;
  return { success: true, message: 'Logged out successfully' };
};

// Verify user credentials (for Tile 2, 3, 4 validation)
export const verifyCredentials = async (
  email: string,
  projectReference: string
): Promise<ApiResponse<boolean>> => {
  try {
    // For mock purposes, we'll check if the user exists
    // In production, this would verify against Wix Data
    const user = mockUsers.get(email);
    if (user) {
      return { success: true, data: true };
    }
    return { success: true, data: false };
  } catch (error) {
    return { success: false, error: 'Failed to verify credentials' };
  }
};

// Check if user is admin
export const isAdmin = (session: UserSession | AdminSession | null): boolean => {
  return session ? 'isAdmin' in session && session.isAdmin : false;
};

// Auto-create user on approval (called after admin approves request)
export const createUserOnApproval = async (
  email: string,
  projectReference: string,
  companyName: string,
  contactName: string
): Promise<ApiResponse<void>> => {
  try {
    // Create user with project reference as password
    if (!mockUsers.has(email)) {
      mockUsers.set(email, {
        email,
        password: projectReference,
        companyName,
        contactName,
      });
    }
    return { success: true, message: 'User created successfully' };
  } catch (error) {
    return { success: false, error: 'Failed to create user' };
  }
};
