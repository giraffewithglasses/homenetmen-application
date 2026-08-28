import React, { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Flame, Compass, Mountain, ChevronRight, CheckCircle2, User, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { api, formatApiError } from "@/lib/api";

const LEADER_ROLES = [
  { value: "patrol_co_leader", label: "Patrol Co-Leader" },
  { value: "patrol_leader", label: "Patrol Leader" },
  { value: "cubs_leader", label: "Cubs Leader" },
  { value: "scout_leader", label: "Scout Leader" },
  { value: "chapter_leader", label: "Chapter Leader" },
];
const SECTIONS = ["Cubs", "Scouts", "Senior Scouts", "Rovers"];

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
function googleLogin() {
  const redirectUrl = window.location.origin + "/";
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
}

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [chapters, setChapters] = useState([]);
  const [busy, setBusy] = useState(false);
  const [pendingMsg, setPendingMsg] = useState("");

  // shared login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Scout signup state
  const [scoutForm, setScoutForm] = useState({
    email: "", password: "", name: "", full_name_hy: "",
    dob: "", gender: "", phone: "",
    chapter_id: "", section: "Scouts", patrol: "",
    guardian_name: "", guardian_phone: "", emergency_contact: "",
  });

  // Leader signup state
  const [leaderForm, setLeaderForm] = useState({
    email: "", password: "", name: "", gender: "",
    chapter_id: "", requested_role: "chapter_leader",
  });

  useEffect(() => { api.get("/chapters").then(r => setChapters(r.data)).catch(() => {}); }, []);
  if (user) return <Navigate to="/dashboard" replace />;

  const doLogin = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await login(email, password); nav("/dashboard"); }
    catch (err) { toast.error(formatApiError(err.response?.data?.detail) || err.message); }
    finally { setBusy(false); }
  };

  const submitScout = async (e) => {
    e.preventDefault();
    if (!scoutForm.chapter_id) return toast.error("Please choose a chapter");
    setBusy(true);
    try {
      const { data } = await api.post("/auth/register", { ...scoutForm, signup_type: "scout" });
      setPendingMsg(data.message || "Registration submitted for approval.");
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail) || err.message); }
    finally { setBusy(false); }
  };

  const submitLeader = async (e) => {
    e.preventDefault();
    if (!leaderForm.chapter_id) return toast.error("Please choose a chapter");
    setBusy(true);
    try {
      const { data } = await api.post("/auth/register", { ...leaderForm, signup_type: "leader" });
      setPendingMsg(data.message || "Leader application submitted for approval.");
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail) || err.message); }
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
            <div className="w-14 h-14 rounded-full flex items-center justify-center bg-white/95 shadow-inner border-2 border-white/40 p-1.5">
              <img src="/brand/homenetmen-logo.webp" alt="HASK" className="w-full h-full object-contain"/>
            </div>
            <div>
              <div className="font-display font-black text-xl leading-none">HOMENETMEN HASK</div>
              <div className="text-[10px] tracking-[0.3em] uppercase opacity-70">ՀՄԸՄ-ՀԱՍԿ · Est. 1989</div>
            </div>
          </div>
          <div>
            <h1 className="font-display text-5xl lg:text-6xl font-black leading-[1.05] max-w-xl">
              Prepared.<br />Together.<br /><span className="text-[hsl(32,87%,67%)]">Outdoors.</span>
            </h1>
            <p className="mt-6 max-w-md text-white/85">The digital home for scouts, leaders, and chapters — manage members, progress, activities, and community from anywhere on the trail.</p>
            <div className="mt-8 flex flex-wrap gap-3 text-xs uppercase tracking-[0.2em]">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur"><Mountain size={14} /> Hiking</span>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur"><Compass size={14} /> Navigation</span>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur"><Flame size={14} /> Camp Craft</span>
            </div>
          </div>
          <div className="text-xs opacity-70">© 2026 · Founded 1989</div>
        </div>
      </div>

      <div className="lg:col-span-2 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="uppercase-label mb-2">Welcome</div>
          <h2 className="font-display text-3xl lg:text-4xl font-black tracking-tight">Sign in or join</h2>
          <p className="text-muted-foreground mt-2 text-sm">Members and leaders each have their own path.</p>

          <Tabs defaultValue="login" className="mt-8">
            <TabsList className="grid grid-cols-3 bg-muted rounded-full p-1">
              <TabsTrigger value="login" className="rounded-full" data-testid="tab-login">Sign in</TabsTrigger>
              <TabsTrigger value="scout" className="rounded-full" data-testid="tab-scout"><User size={12} className="mr-1"/>Scout</TabsTrigger>
              <TabsTrigger value="leader" className="rounded-full" data-testid="tab-leader"><Shield size={12} className="mr-1"/>Leader</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={doLogin} className="space-y-4 mt-6">
                <div><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="login-email" placeholder="you@scouts.am" /></div>
                <div><Label>Password</Label><PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required data-testid="login-password" /></div>
                <Button type="submit" disabled={busy} className="w-full btn-pill h-12 bg-[hsl(12,65%,63%)] hover:bg-[hsl(12,70%,55%)]" data-testid="login-submit">
                  {busy ? "Signing in…" : (<>Sign in <ChevronRight size={16} className="ml-1" /></>)}
                </Button>
              </form>
              <div className="text-xs text-muted-foreground mt-4">
                Demo: <b>hovsepmarachlian@gmail.com</b> / <b>admin123</b> · <b>narek@scouts.am</b> / <b>scout123</b>
              </div>
            </TabsContent>

            <TabsContent value="scout">
              {pendingMsg ? <PendingCard message={pendingMsg}/> : (
                <form onSubmit={submitScout} className="space-y-3 mt-6 max-h-[65vh] overflow-y-auto pr-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Full name</Label><Input value={scoutForm.name} onChange={e => setScoutForm({...scoutForm, name: e.target.value})} required data-testid="scout-name"/></div>
                    <div><Label>Armenian name</Label><Input value={scoutForm.full_name_hy} onChange={e => setScoutForm({...scoutForm, full_name_hy: e.target.value})}/></div>
                  </div>
                  <div><Label>Email</Label><Input type="email" value={scoutForm.email} onChange={e => setScoutForm({...scoutForm, email: e.target.value})} required data-testid="scout-email"/></div>
                  <div><Label>Password</Label><PasswordInput value={scoutForm.password} onChange={e => setScoutForm({...scoutForm, password: e.target.value})} required data-testid="scout-password"/></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Date of birth</Label><Input type="date" value={scoutForm.dob} onChange={e => setScoutForm({...scoutForm, dob: e.target.value})} data-testid="scout-dob"/></div>
                    <div><Label>Gender</Label>
                      <Select value={scoutForm.gender} onValueChange={v => setScoutForm({...scoutForm, gender: v})}>
                        <SelectTrigger data-testid="scout-gender"><SelectValue placeholder="—"/></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="M">Male</SelectItem>
                          <SelectItem value="F">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div><Label>Phone</Label><Input value={scoutForm.phone} onChange={e => setScoutForm({...scoutForm, phone: e.target.value})}/></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Chapter</Label>
                      <Select value={scoutForm.chapter_id} onValueChange={v => setScoutForm({...scoutForm, chapter_id: v})}>
                        <SelectTrigger data-testid="scout-chapter"><SelectValue placeholder="Choose"/></SelectTrigger>
                        <SelectContent>{chapters.map(c => <SelectItem key={c.chapter_id} value={c.chapter_id}>{c.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Section</Label>
                      <Select value={scoutForm.section} onValueChange={v => setScoutForm({...scoutForm, section: v})}>
                        <SelectTrigger data-testid="scout-section"><SelectValue/></SelectTrigger>
                        <SelectContent>{SECTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div><Label>Patrol (optional)</Label><Input value={scoutForm.patrol} onChange={e => setScoutForm({...scoutForm, patrol: e.target.value})} placeholder="Eagle, Wolf…"/></div>
                  <div className="pt-2 border-t border-border">
                    <div className="uppercase-label mb-2">Guardian & emergency</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Guardian name</Label><Input value={scoutForm.guardian_name} onChange={e => setScoutForm({...scoutForm, guardian_name: e.target.value})}/></div>
                      <div><Label>Guardian phone</Label><Input value={scoutForm.guardian_phone} onChange={e => setScoutForm({...scoutForm, guardian_phone: e.target.value})}/></div>
                    </div>
                    <div className="mt-3"><Label>Emergency contact</Label><Input value={scoutForm.emergency_contact} onChange={e => setScoutForm({...scoutForm, emergency_contact: e.target.value})}/></div>
                  </div>
                  <Button type="submit" disabled={busy} className="w-full btn-pill h-12 bg-[hsl(149,40%,30%)] hover:bg-[hsl(149,45%,25%)] mt-2" data-testid="scout-submit">
                    {busy ? "Sending…" : "Request scout account"}
                  </Button>
                  <p className="text-[10px] text-muted-foreground text-center">Approved by a chapter leader → creates both your account and your member record.</p>
                </form>
              )}
            </TabsContent>

            <TabsContent value="leader">
              {pendingMsg ? <PendingCard message={pendingMsg}/> : (
                <form onSubmit={submitLeader} className="space-y-4 mt-6">
                  <div><Label>Full name</Label><Input value={leaderForm.name} onChange={e => setLeaderForm({...leaderForm, name: e.target.value})} required data-testid="leader-name"/></div>
                  <div><Label>Email</Label><Input type="email" value={leaderForm.email} onChange={e => setLeaderForm({...leaderForm, email: e.target.value})} required data-testid="leader-email"/></div>
                  <div><Label>Password</Label><PasswordInput value={leaderForm.password} onChange={e => setLeaderForm({...leaderForm, password: e.target.value})} required data-testid="leader-password"/></div>
                  <div><Label>Gender</Label>
                    <Select value={leaderForm.gender} onValueChange={v => setLeaderForm({...leaderForm, gender: v})}>
                      <SelectTrigger data-testid="leader-gender"><SelectValue placeholder="—"/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M">Male</SelectItem>
                        <SelectItem value="F">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Chapter</Label>
                    <Select value={leaderForm.chapter_id} onValueChange={v => setLeaderForm({...leaderForm, chapter_id: v})}>
                      <SelectTrigger data-testid="leader-chapter"><SelectValue placeholder="Choose your chapter"/></SelectTrigger>
                      <SelectContent>{chapters.map(c => <SelectItem key={c.chapter_id} value={c.chapter_id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Requested leader role</Label>
                    <Select value={leaderForm.requested_role} onValueChange={v => setLeaderForm({...leaderForm, requested_role: v})}>
                      <SelectTrigger data-testid="leader-role"><SelectValue/></SelectTrigger>
                      <SelectContent>{LEADER_ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" disabled={busy} className="w-full btn-pill h-12 bg-[hsl(12,65%,63%)] hover:bg-[hsl(12,70%,55%)]" data-testid="leader-submit">
                    {busy ? "Sending…" : "Request leader account"}
                  </Button>
                  <p className="text-[10px] text-muted-foreground text-center">Approved leader applications appear in Administration → Users with your requested role.</p>
                </form>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex items-center gap-3 my-6">
            <div className="h-px flex-1 bg-border" /><span className="text-xs uppercase tracking-widest text-muted-foreground">or</span><div className="h-px flex-1 bg-border" />
          </div>
          <Button type="button" variant="outline" className="w-full btn-pill h-12 border-2" onClick={googleLogin} data-testid="google-login-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" className="mr-2"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.56c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.56-2.77c-.99.66-2.25 1.05-3.72 1.05-2.86 0-5.29-1.93-6.15-4.53H2.18v2.85A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.85 14.1a6.6 6.6 0 0 1 0-4.2V7.05H2.18a11 11 0 0 0 0 9.9l3.67-2.85z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.2 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.05l3.67 2.85C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
            Continue with Google
          </Button>
        </div>
      </div>
    </div>
  );
}

function PendingCard({ message }) {
  return (
    <div className="mt-6 p-6 rounded-2xl bg-[hsl(149,40%,30%)]/10 border border-[hsl(149,40%,30%)]/30" data-testid="reg-pending-card">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[hsl(149,40%,30%)] text-white flex items-center justify-center"><CheckCircle2 size={20}/></div>
        <div className="font-display font-bold text-lg">Awaiting approval</div>
      </div>
      <p className="text-sm mt-3">{message}</p>
      <p className="text-xs text-muted-foreground mt-4">You'll get an in-app notification and be able to sign in as soon as a chapter leader approves.</p>
    </div>
  );
}
