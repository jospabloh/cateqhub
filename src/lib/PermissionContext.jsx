import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { isParishAdmin } from "@/lib/roles";
import { permissionKey, getRegistryDefaults } from "@/lib/permissionRegistry";

const PermissionContext = createContext(null);

export function PermissionProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    // El admin (de parroquia o de plataforma) siempre tiene acceso total y
    // no necesita un perfil guardado.
    if (!isAuthenticated || !user?.parish_id || isParishAdmin(user)) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await base44.entities.PermissionProfile.filter({
        parish_id: user.parish_id,
        role_key: "catequist",
      });
      setProfile(rows?.[0] || null);
    } catch (_) {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => { load(); }, [load]);

  const can = useCallback((module, action) => {
    if (isParishAdmin(user)) return true;
    const key = permissionKey(module, action);
    const saved = profile?.permissions?.[key];
    if (saved === true) return true;
    if (saved === false) return false;
    return getRegistryDefaults()[key] ?? false;
  }, [user, profile]);

  return (
    <PermissionContext.Provider value={{ profile, loading, can, reload: load }}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const ctx = useContext(PermissionContext);
  if (!ctx) {
    return { profile: null, loading: false, can: () => true, reload: () => {} };
  }
  return ctx;
}
