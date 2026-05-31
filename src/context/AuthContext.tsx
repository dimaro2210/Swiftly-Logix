import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabase";

interface User {
  firstName: string;
  lastName: string;
  email: string;
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
    // Check active sessions and sets the user
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await fetchProfile(session.user.id, session.user.email!);
      } else {
        setLoading(false);
      }
    };

    checkSession();

    // Listen for changes on auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await fetchProfile(session.user.id, session.user.email!);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string, email: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching profile:", error);
      }

      if (data) {
        setUser({
          firstName: data.first_name,
          lastName: data.last_name,
          email: data.email,
          accountType: data.account_type,
          userId: data.user_id,
          company: data.company,
          address: data.address,
          postalCode: data.postal_code,
          profilePicture: data.profile_picture,
          status: data.status,
          is_admin: data.is_admin,
        });
      } else {
        // Fallback if profile doesn't exist yet (e.g. just signed up and trigger is delayed)
        setUser({
          firstName: "",
          lastName: "",
          email: email,
          accountType: "Personal",
          userId: email.split('@')[0],
          status: "pending"
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: "Invalid credentials. Please try again." };
      }

      // Fetch profile to check status
      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('status')
          .eq('id', data.user.id)
          .single();

        if (profile?.status === 'pending') {
          await supabase.auth.signOut();
          return { success: false, error: "Account is under review we will get back to you shortly." };
        }
        if (profile?.status === 'declined') {
          await supabase.auth.signOut();
          return { success: false, error: "Your account has been declined. Please contact support." };
        }
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: "An unexpected error occurred." };
    }
  };

  const register = async (data: RegisterData): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            first_name: data.firstName,
            last_name: data.lastName,
            account_type: data.accountType,
            user_id: data.userId,
            company: data.company,
            address: data.address,
            postal_code: data.postalCode,
          }
        }
      });

      if (error) {
        if (error.message.includes('already registered')) {
          return { success: false, error: "Email already exists." };
        }
        return { success: false, error: error.message };
      }

      // We sign them out immediately since they are 'pending'
      await supabase.auth.signOut();

      return { success: true };
    } catch {
      return { success: false, error: "An error occurred. Please try again." };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const updateProfilePicture = async (dataUri: string) => {
    if (!user) return;
    
    // Optimistic update
    setUser({ ...user, profilePicture: dataUri });

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase
        .from('profiles')
        .update({ profile_picture: dataUri })
        .eq('id', session.user.id);
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
