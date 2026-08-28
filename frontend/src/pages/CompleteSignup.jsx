import React, { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatApiError } from "@/lib/api";
import { CheckCircle2, User, Shield, Flame } from "lucide-react";

const LEADER_ROLES = [
  { value: "patrol_co_leader", label: "Patrol Co-Leader" },
  { value: "patrol_leader", label: "Patrol Leader" },
  { value: "cubs_leader", label: "Cubs Leader" },
  { value: "scout_leader", label: "Scout Leader" },
  { value: "chapter_leader", label: "Chapter Leader" },
];
const SECTIONS = ["Cubs", "Scouts", "Senior Scouts", "Rovers"];

export default function CompleteSignup() {
  const { user, logout, checkAuth } = useAuth();
  const nav = useNavigate();
  const [chapters, setChapters] = useState([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const [scoutForm, setScoutForm] = useState({
    chapter_id: "", section: "Scouts", patrol: "",
    dob: "", gender: "", phone: "",
    full_name_hy: "",
    guardian_name: "", guardian_phone: "", emergency_contact: "",
  });
  const [leaderForm, setLeaderForm] = useState({
    chapter_id: "", requested_role: "chapter_leader",
  });

  useEffect(() => { api.get("/chapters").then(r => setChapters(r.data)).catch(() => {}); }, []);

  if (!user) return <Navigate to="/login" replace />;
  if (user.status && user.status !== "profile_incomplete" && user.status !== "pending") {
    return <Navigate to="/dashboard" replace />;
  }
  if (user.status === "pending" && !done) {
    return <PendingScreen onSignOut={async () => { await logout(); nav("/login"); }} />;
  }

  const submit = async (payload, kind) => {
    if (!payload.chapter_id) return toast.error("Please choose a chapter");
    setBusy(true);
    try {
      await api.post("/auth/complete-profile", { ...payload, signup_type: kind });
      setDone(true);
      await checkAuth();
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail) || err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen p-4 lg:p-10 flex items-center justify-center">
      <Card className="clay-card w-full max-w-2xl p-8 lg:p-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-white shadow-inner border-2 border-border p-1"><img src="/brand/homenetmen-logo.webp" alt="HASK" className="w-full h-full object-contain"/></div>
          <div>
            <div className="uppercase-label">Almost there</div>
            <h1 className="font-display text-3xl font-black">Complete your signup</h1>
          </div>
        </div>
        <p className="text-sm text-muted-foreground -mt-2 mb-6">Welcome, <b>{user.name}</b>. Tell us a bit more so a chapter leader can approve your account.</p>

        <Tabs defaultValue="scout">
          <TabsList className="rounded-full bg-muted p-1 grid grid-cols-2">
            <TabsTrigger value="scout" className="rounded-full" data-testid="cs-tab-scout"><User size={12} className="mr-1"/> Join as Scout</TabsTrigger>
            <TabsTrigger value="leader" className="rounded-full" data-testid="cs-tab-leader"><Shield size={12} className="mr-1"/> Join as Leader</TabsTrigger>
          </TabsList>

          <TabsContent value="scout">
            <form onSubmit={(e) => { e.preventDefault(); submit(scoutForm, "scout"); }} className="space-y-3 mt-6">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Chapter</Label>
                  <Select value={scoutForm.chapter_id} onValueChange={v => setScoutForm({...scoutForm, chapter_id: v})}>
                    <SelectTrigger data-testid="cs-chapter"><SelectValue placeholder="Choose"/></SelectTrigger>
                    <SelectContent>{chapters.map(c => <SelectItem key={c.chapter_id} value={c.chapter_id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Section</Label>
                  <Select value={scoutForm.section} onValueChange={v => setScoutForm({...scoutForm, section: v})}>
                    <SelectTrigger data-testid="cs-section"><SelectValue/></SelectTrigger>
                    <SelectContent>{SECTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Armenian name</Label><Input value={scoutForm.full_name_hy} onChange={e => setScoutForm({...scoutForm, full_name_hy: e.target.value})}/></div>
                <div><Label>Patrol (optional)</Label><Input value={scoutForm.patrol} onChange={e => setScoutForm({...scoutForm, patrol: e.target.value})}/></div>
                <div><Label>Date of birth</Label><Input type="date" value={scoutForm.dob} onChange={e => setScoutForm({...scoutForm, dob: e.target.value})} data-testid="cs-dob"/></div>
                <div><Label>Gender</Label>
                  <Select value={scoutForm.gender} onValueChange={v => setScoutForm({...scoutForm, gender: v})}>
                    <SelectTrigger data-testid="cs-gender"><SelectValue placeholder="—"/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Male</SelectItem>
                      <SelectItem value="F">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2"><Label>Phone</Label><Input value={scoutForm.phone} onChange={e => setScoutForm({...scoutForm, phone: e.target.value})}/></div>
              </div>
              <div className="pt-2 border-t border-border">
                <div className="uppercase-label mb-2 mt-3">Guardian & emergency</div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Guardian name</Label><Input value={scoutForm.guardian_name} onChange={e => setScoutForm({...scoutForm, guardian_name: e.target.value})}/></div>
                  <div><Label>Guardian phone</Label><Input value={scoutForm.guardian_phone} onChange={e => setScoutForm({...scoutForm, guardian_phone: e.target.value})}/></div>
                </div>
                <div className="mt-3"><Label>Emergency contact</Label><Input value={scoutForm.emergency_contact} onChange={e => setScoutForm({...scoutForm, emergency_contact: e.target.value})}/></div>
              </div>
              <Button type="submit" disabled={busy} className="w-full btn-pill h-12 bg-[hsl(149,40%,30%)] hover:bg-[hsl(149,45%,25%)]" data-testid="cs-scout-submit">
                {busy ? "Sending…" : "Submit for approval"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="leader">
            <form onSubmit={(e) => { e.preventDefault(); submit(leaderForm, "leader"); }} className="space-y-4 mt-6">
              <div><Label>Chapter</Label>
                <Select value={leaderForm.chapter_id} onValueChange={v => setLeaderForm({...leaderForm, chapter_id: v})}>
                  <SelectTrigger data-testid="cs-leader-chapter"><SelectValue placeholder="Choose"/></SelectTrigger>
                  <SelectContent>{chapters.map(c => <SelectItem key={c.chapter_id} value={c.chapter_id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Requested leader role</Label>
                <Select value={leaderForm.requested_role} onValueChange={v => setLeaderForm({...leaderForm, requested_role: v})}>
                  <SelectTrigger data-testid="cs-leader-role"><SelectValue/></SelectTrigger>
                  <SelectContent>{LEADER_ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={busy} className="w-full btn-pill h-12 bg-[hsl(12,65%,63%)] hover:bg-[hsl(12,70%,55%)]" data-testid="cs-leader-submit">
                {busy ? "Sending…" : "Submit for approval"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}

function PendingScreen({ onSignOut }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="clay-card max-w-lg p-10 text-center">
        <div className="w-14 h-14 rounded-full bg-[hsl(149,40%,30%)] text-white flex items-center justify-center mx-auto"><CheckCircle2 size={26}/></div>
        <h2 className="font-display font-black text-3xl mt-4">Awaiting approval</h2>
        <p className="text-sm text-muted-foreground mt-3">Your account and profile are with the chapter leaders. You'll be able to sign in as soon as they approve.</p>
        <Button className="mt-6 btn-pill" variant="outline" onClick={onSignOut} data-testid="cs-signout">Sign out</Button>
      </Card>
    </div>
  );
}
