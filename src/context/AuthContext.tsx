import { createContext, useContext, useState, useEffect, ReactNode } from "react";
// Removed Supabase import

interface User {
  firstName: string;
  lastName: string;
  email: string;
  password?: string; // Stored locally for simple auth
  accountType: "Personal" | "Business";
  userId: string;
  company?: string;
  address?: string;
  postalCode?: string;
  profilePicture?: string;
  status?: "pending" | "approved" | "declined";
  is_admin?: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfilePicture: (dataUri: string) => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
}

interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  accountType: "Personal" | "Business";
  userId: string;
  company?: string;
  address?: string;
  postalCode?: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const isAuthenticated = user !== null;

  useEffect(() => {
    // Check local session
    const checkSession = () => {
      try {
        const sessionEmail = localStorage.getItem('swiftly_session');
        if (sessionEmail) {
          const usersRaw = localStorage.getItem('swiftly_users');
          const users: User[] = usersRaw ? JSON.parse(usersRaw) : [];
          const found = users.find(u => u.email === sessionEmail);
          if (found) {
            setUser(found);
          } else {
            localStorage.removeItem('swiftly_session');
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const usersRaw = localStorage.getItem('swiftly_users');
      const users: User[] = usersRaw ? JSON.parse(usersRaw) : [];
      const found = users.find(u => u.email.toLowerCase() === email.toLowerCase());

      if (!found || found.password !== password) {
        return { success: false, error: "Invalid credentials. Please try again." };
      }

      if (found.status === 'pending') {
        return { success: false, error: "Account is under review we will get back to you shortly." };
      }
      if (found.status === 'declined') {
        return { success: false, error: "Your account has been declined. Please contact support." };
      }

      localStorage.setItem('swiftly_session', found.email);
      setUser(found);
      return { success: true };
    } catch (err) {
      return { success: false, error: "An unexpected error occurred." };
    }
  };

  const register = async (data: RegisterData): Promise<{ success: boolean; error?: string }> => {
    try {
      const usersRaw = localStorage.getItem('swiftly_users');
      const users: User[] = usersRaw ? JSON.parse(usersRaw) : [];
      
      const exists = users.find(u => u.email.toLowerCase() === data.email.toLowerCase());
      if (exists) {
        return { success: false, error: "Email already exists." };
      }

      const newUser: User = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        accountType: data.accountType,
        userId: data.userId,
        company: data.company,
        address: data.address,
        postalCode: data.postalCode,
        status: "pending"
      };

      users.push(newUser);
      localStorage.setItem('swiftly_users', JSON.stringify(users));

      // We do not set session because they are pending
      return { success: true };
    } catch {
      return { success: false, error: "An error occurred. Please try again." };
    }
  };

  const logout = async () => {
    localStorage.removeItem('swiftly_session');
    setUser(null);
  };

  const updateProfilePicture = async (dataUri: string) => {
    if (!user) return;
    
    // Optimistic update
    setUser({ ...user, profilePicture: dataUri });

    try {
      const usersRaw = localStorage.getItem('swiftly_users');
      if (usersRaw) {
        const users: User[] = JSON.parse(usersRaw);
        const index = users.findIndex(u => u.email === user.email);
        if (index >= 0) {
          users[index].profilePicture = dataUri;
          localStorage.setItem('swiftly_users', JSON.stringify(users));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateProfilePicture, isAuthenticated, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
