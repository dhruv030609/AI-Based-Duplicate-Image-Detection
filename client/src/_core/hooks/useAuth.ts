import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo, useState } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

const broadcastAuthChange = (user: any) => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("app:auth-change", { detail: { user } }));
  }
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();

  const [activeUser, setActiveUser] = useState<any>(() => {
    try {
      const raw = localStorage.getItem("manus-runtime-user-info");
      if (raw && raw !== "null" && raw !== "undefined") {
        return JSON.parse(raw);
      }
    } catch {}
    return null;
  });

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  // Synchronize across components via custom event
  useEffect(() => {
    const handleAuthEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      setActiveUser(customEvent.detail?.user ?? null);
    };
    window.addEventListener("app:auth-change", handleAuthEvent);
    return () => window.removeEventListener("app:auth-change", handleAuthEvent);
  }, []);

  // Synchronize with meQuery results
  useEffect(() => {
    if (meQuery.data) {
      setActiveUser(meQuery.data);
      try {
        localStorage.setItem("manus-runtime-user-info", JSON.stringify(meQuery.data));
      } catch {}
    } else if (meQuery.data === null && !meQuery.isLoading) {
      const hasToken =
        localStorage.getItem("app_session_token") ||
        sessionStorage.getItem("manus-cookie");
      if (!hasToken) {
        setActiveUser(null);
        try {
          localStorage.removeItem("manus-runtime-user-info");
        } catch {}
      }
    }
  }, [meQuery.data, meQuery.isLoading]);

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      try {
        sessionStorage.removeItem("manus-cookie");
        localStorage.removeItem("app_session_token");
        localStorage.removeItem("manus-runtime-user-info");
      } catch {}
      setActiveUser(null);
      broadcastAuthChange(null);
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const effectiveUser = activeUser ?? meQuery.data ?? null;

  const state = useMemo(() => {
    return {
      user: effectiveUser,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(effectiveUser),
    };
  }, [
    effectiveUser,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (redirectPath && window.location.pathname === redirectPath) return;

    if (redirectPath) {
      window.location.href = redirectPath;
    } else {
      startLogin();
    }
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      utils.auth.me.setData(undefined, data.user ?? null);
    },
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      utils.auth.me.setData(undefined, data.user ?? null);
    },
  });

  const login = useCallback(
    async (params: { emailOrName: string; role?: "user" | "admin" }) => {
      const res = await loginMutation.mutateAsync(params);
      if (res.token) {
        try {
          sessionStorage.setItem("manus-cookie", `app_session_id=${res.token}`);
          localStorage.setItem("app_session_token", res.token);
          localStorage.setItem("manus-runtime-user-info", JSON.stringify(res.user));
        } catch {}
      }
      setActiveUser(res.user);
      broadcastAuthChange(res.user);
      utils.auth.me.setData(undefined, res.user ?? null);
      utils.auth.me.refetch();
      return res.user;
    },
    [loginMutation, utils]
  );

  const register = useCallback(
    async (params: { name: string; email: string; role?: "user" | "admin" }) => {
      const res = await registerMutation.mutateAsync(params);
      if (res.token) {
        try {
          sessionStorage.setItem("manus-cookie", `app_session_id=${res.token}`);
          localStorage.setItem("app_session_token", res.token);
          localStorage.setItem("manus-runtime-user-info", JSON.stringify(res.user));
        } catch {}
      }
      setActiveUser(res.user);
      broadcastAuthChange(res.user);
      utils.auth.me.setData(undefined, res.user ?? null);
      utils.auth.me.refetch();
      return res.user;
    },
    [registerMutation, utils]
  );

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    login,
    register,
    logout,
  };
}
