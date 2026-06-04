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
    // Listen to Supabase auth state changes
    // DO NOT use an async callback here, it will deadlock Supabase's internal auth queue!
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        // Fetch user profile from public.users table without blocking the auth queue
        supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()
          .then(({ data: profile, error }) => {
            if (error) {
              console.error("[AuthContext] Error fetching profile:", error);
            }
            if (profile) {
              setUser({
                firstName: profile.first_name || '',
                lastName: profile.last_name || '',
                email: profile.email,
                accountType: profile.account_type as any,
                userId: profile.user_id,
                company: profile.company,
                address: profile.address,
                postalCode: profile.postal_code,
                profilePicture: profile.profile_picture,
                status: profile.status,
                is_admin: profile.role === 'admin'
              });
            } else {
              // If profile doesn't exist, we might need to handle it or leave user null
              console.warn("[AuthContext] Profile not found for user:", session.user.id);
              setUser(null);
            }
            setLoading(false);
          })
          .catch(err => {
            console.error("[AuthContext] Exception fetching profile:", err);
            setUser(null);
            setLoading(false);
          });
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      let authUser = null;
      console.log("[LOGIN] Starting login process for:", email);

      console.log("[LOGIN] Calling getSession()...");
      const { data: { session } } = await supabase.auth.getSession();
      console.log("[LOGIN] getSession() returned. Session exists?", !!session);

      if (session?.user && session.user.email === email) {
        console.log("[LOGIN] Using existing session for:", email);
        authUser = session.user;
      } else {
        console.log("[LOGIN] Calling signInWithPassword()...");
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        console.log("[LOGIN] signInWithPassword() returned. Error?", !!error);

        if (error) {
          return { success: false, error: "Invalid credentials. Please try again." };
        }
        authUser = data.user;
      }

      console.log("[LOGIN] Auth successful. Checking user status...");
      // Check status after login
      if (authUser) {
        console.log("[LOGIN] Fetching user profile from public.users...");
        const { data: profile } = await supabase
          .from('users')
          .select('status')
          .eq('id', authUser.id)
          .single();
        console.log("[LOGIN] Profile fetched. Status:", profile?.status);
          
        if (profile?.status === 'pending') {
          console.log("[LOGIN] Status pending. Calling signOut()...");
          await supabase.auth.signOut();
          console.log("[LOGIN] signOut() finished.");
          return { success: false, error: "Account is under review we will get back to you shortly." };
        }
        if (profile?.status === 'declined') {
          console.log("[LOGIN] Status declined. Calling signOut()...");
          await supabase.auth.signOut();
          console.log("[LOGIN] signOut() finished.");
          return { success: false, error: "Your account has been declined. Please contact support." };
        }
      }

      console.log("[LOGIN] Login complete. Returning success.");
      return { success: true };
    } catch (err: any) {
      console.error("[LOGIN] Caught exception:", err);
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
            status: "pending"
          }
        }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      // Automatically sign out because they are pending
      await supabase.auth.signOut();
      
      return { success: true };
    } catch (err: any) {
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

    try {
      const { data: session } = await supabase.auth.getSession();
      if (session?.session?.user) {
        await supabase
          .from('users')
          .update({ profile_picture: dataUri })
          .eq('id', session.session.user.id);
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
