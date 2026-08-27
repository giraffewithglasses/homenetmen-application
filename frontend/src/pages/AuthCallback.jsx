import React, { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback() {
  const loc = useLocation();
  const nav = useNavigate();
  const { setUser } = useAuth();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const hash = loc.hash || "";
    const m = hash.match(/session_id=([^&]+)/);
    if (!m) { nav("/login"); return; }
    (async () => {
      try {
        const { data } = await api.post("/auth/session", { session_id: m[1] });
        setUser(data, null);
        const target = (data.status === "profile_incomplete" || data.status === "pending") ? "/complete-signup" : "/dashboard";
        window.history.replaceState(null, "", target);
        nav(target, { replace: true });
      } catch (e) {
        nav("/login", { replace: true });
      }
    })();
  }, [loc, nav, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full border-4 border-[hsl(12,65%,63%)] border-t-transparent animate-spin mx-auto" />
        <div className="mt-4 text-sm text-muted-foreground">Setting up your patrol…</div>
      </div>
    </div>
  );
}
