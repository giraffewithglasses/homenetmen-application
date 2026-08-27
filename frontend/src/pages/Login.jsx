import React, { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Flame, Compass, Mountain, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
function googleLogin() {
  const redirectUrl = window.location.origin + "/";
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
}

export default function Login() {
  const { user, login, register } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const doLogin = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await login(email, password); nav("/dashboard"); }
    catch (err) { toast.error(formatApiError(err.response?.data?.detail) || err.message); }
    finally { setBusy(false); }
  };
  const doRegister = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await register({ email, password, name }); nav("/dashboard"); }
    catch (err) { toast.error(formatApiError(err.response?.data?.detail) || err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-5">
      <div
        className="hidden lg:block lg:col-span-3 relative overflow-hidden"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1599828586134-fbaff96c63d5?crop=entropy&cs=srgb&fm=jpg&q=85')",
          backgroundSize: "cover", backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0" style={{ background: "linear-gradient(115deg, hsl(152 43% 15% / 0.85), hsl(152 43% 15% / 0.35))" }} />
        <div className="relative z-10 h-full flex flex-col justify-between p-14 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-[hsl(12,65%,63%)] shadow-inner border-2 border-white/30">
              <Flame size={22} />
            </div>
            <div>
              <div className="font-display font-black text-xl leading-none">SCOUTS OF ARMENIA</div>
              <div className="text-[10px] tracking-[0.35em] uppercase opacity-70">Հայաստանի սկաուտներ</div>
            </div>
          </div>
          <div>
            <h1 className="font-display text-5xl lg:text-6xl font-black leading-[1.05] max-w-xl">
              Prepared.<br />Together.<br />
              <span className="text-[hsl(32,87%,67%)]">Outdoors.</span>
            </h1>
            <p className="mt-6 max-w-md text-white/85">
              The digital home for scouts, leaders, and chapters — manage members, progress, activities, and community from anywhere on the trail.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-xs uppercase tracking-[0.2em]">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur"><Mountain size={14} /> Hiking</span>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur"><Compass size={14} /> Navigation</span>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur"><Flame size={14} /> Camp Craft</span>
            </div>
          </div>
          <div className="text-xs opacity-70">© 2026 · Founded 1918</div>
        </div>
      </div>

      <div className="lg:col-span-2 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-[hsl(12,65%,63%)] text-white">
              <Flame size={22} />
            </div>
            <div className="font-display font-black text-lg">SCOUTS OF ARMENIA</div>
          </div>
          <div className="uppercase-label mb-2">Welcome back</div>
          <h2 className="font-display text-3xl lg:text-4xl font-black tracking-tight">Sign in to your patrol</h2>
          <p className="text-muted-foreground mt-2 text-sm">Use your scouting credentials or continue with Google.</p>

          <Tabs defaultValue="login" className="mt-8">
            <TabsList className="grid grid-cols-2 bg-muted rounded-full p-1">
              <TabsTrigger value="login" className="rounded-full" data-testid="tab-login">Sign in</TabsTrigger>
              <TabsTrigger value="register" className="rounded-full" data-testid="tab-register">Register</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form onSubmit={doLogin} className="space-y-4 mt-6">
                <div>
                  <Label>Email</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="login-email" placeholder="you@scouts.am" />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required data-testid="login-password" />
                </div>
                <Button type="submit" disabled={busy} className="w-full btn-pill h-12 bg-[hsl(12,65%,63%)] hover:bg-[hsl(12,70%,55%)]" data-testid="login-submit">
                  {busy ? "Signing in…" : (<>Sign in <ChevronRight size={16} className="ml-1" /></>)}
                </Button>
              </form>
              <div className="text-xs text-muted-foreground mt-4">
                Demo: <b>admin@scouts.am</b> / <b>admin123</b> · <b>narek@scouts.am</b> / <b>scout123</b>
              </div>
            </TabsContent>
            <TabsContent value="register">
              <form onSubmit={doRegister} className="space-y-4 mt-6">
                <div><Label>Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required data-testid="reg-name" /></div>
                <div><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="reg-email" /></div>
                <div><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required data-testid="reg-password" /></div>
                <Button type="submit" disabled={busy} className="w-full btn-pill h-12 bg-[hsl(149,40%,30%)] hover:bg-[hsl(149,45%,25%)]" data-testid="reg-submit">
                  {busy ? "Creating…" : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="flex items-center gap-3 my-6">
            <div className="h-px flex-1 bg-border" /><span className="text-xs uppercase tracking-widest text-muted-foreground">or</span><div className="h-px flex-1 bg-border" />
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full btn-pill h-12 border-2"
            onClick={googleLogin}
            data-testid="google-login-btn"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" className="mr-2"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.56c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.56-2.77c-.99.66-2.25 1.05-3.72 1.05-2.86 0-5.29-1.93-6.15-4.53H2.18v2.85A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.85 14.1a6.6 6.6 0 0 1 0-4.2V7.05H2.18a11 11 0 0 0 0 9.9l3.67-2.85z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.2 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.05l3.67 2.85C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
            Continue with Google
          </Button>
        </div>
      </div>
    </div>
  );
}
