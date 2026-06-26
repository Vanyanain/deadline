import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, tokenStore, setUnauthorizedHandler } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Boot: if we have a token, resolve the current user.
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    const token = tokenStore.get();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const { token, user } = await api.login(email, password);
    tokenStore.set(token);
    setUser(user);
    return user;
  }, []);

  const register = useCallback(async (email, password, name) => {
    const { token, user } = await api.register(email, password, name);
    tokenStore.set(token);
    setUser(user);
    return user;
  }, []);

  const loginWithGoogle = useCallback(async (credential) => {
    const { token, user } = await api.googleLogin(credential);
    tokenStore.set(token);
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  // Patch local user after a profile update without a refetch.
  const patchUser = useCallback((updates) => {
    setUser((u) => (u ? { ...u, ...updates } : u));
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, loginWithGoogle, logout, patchUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
