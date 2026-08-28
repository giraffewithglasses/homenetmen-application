import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Mail, Phone, Calendar, User, Shield, IdCard, Plus, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import BadgePatch from "@/components/BadgePatch";

const LEADER_ROLES = ["national_admin", "chapter_admin", "chapter_leader", "scout_leader", "cubs_leader", "patrol_leader", "patrol_co_leader"];

export default function MemberDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [m, setM] = useState(null);
  const [allBadges, setAllBadges] = useState([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignBid, setAssignBid] = useState("");
  const [tracking, setTracking] = useState(null); // { mb, badge }

  const load = () => {
    api.get(`/members/${id}`).then(r => setM(r.data));
    api.get("/badges").then(r => setAllBadges(r.data));
  };
  useEffect(() => { load(); }, [id]);

  if (!m) return <div>Loading…</div>;

  const badgeById = (bid) => allBadges.find(b => b.badge_id === bid);
  const attStats = m.attendance?.reduce((acc, a) => { acc[a.status] = (acc[a.status] || 0) + 1; return acc; }, {}) || {};
  const isLeader = user?.role && LEADER_ROLES.includes(user.role);
  const takenBadgeIds = new Set((m.badges || []).map(mb => mb.badge_id));
  const availableBadges = allBadges.filter(b => !takenBadgeIds.has(b.badge_id) && !b.archived);

  const assign = async () => {
    if (!assignBid) return toast.error("Choose a badge");
    try {
      await api.post("/badges/assign", { member_id: m.member_id, badge_id: assignBid });
      toast.success("Badge assigned — scout notified");
      setAssignOpen(false); setAssignBid(""); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const award = async (badge_id) => {
    try {
      await api.post("/badges/award", { member_id: m.member_id, badge_id });
      toast.success("Badge awarded!");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const toggleRequirement = async (badge_id, idx, completed) => {
    try {
      await api.post("/badges/progress", { member_id: m.member_id, badge_id, requirement_index: idx, completed });
      // optimistic update
      setTracking(prev => {
        if (!prev || prev.badge.badge_id !== badge_id) return prev;
        const arr = [...(prev.mb.completed_requirements || [])];
        while (arr.length < (prev.badge.requirements || []).length) arr.push(false);
        arr[idx] = completed;
        return { ...prev, mb: { ...prev.mb, completed_requirements: arr } };
      });
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const openTrack = (mb, badge) => setTracking({ mb, badge });

  return (
    <div className="space-y-6">
      <Link to="/members" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={14}/> All members</Link>

      <Card className="clay-card p-8">
        <div className="flex items-start gap-6">
          <div className="w-24 h-24 rounded-full bg-[hsl(12,65%,63%)]/20 text-[hsl(12,65%,63%)] flex items-center justify-center font-black text-4xl font-display">{m.full_name[0]}</div>
          <div className="flex-1">
            <div className="uppercase-label">Scout profile</div>
            <h1 className="font-display text-4xl font-black">{m.full_name}</h1>
            <div className="text-muted-foreground">{m.full_name_hy}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge className="rounded-full bg-[hsl(149,40%,30%)]">{m.section}</Badge>
              <Badge variant="outline" className="rounded-full">{m.patrol} Patrol</Badge>
              <Badge variant="outline" className="rounded-full">{m.position}</Badge>
              <Badge variant={m.status === "active" ? "default" : "secondary"} className="rounded-full">{m.status}</Badge>
            </div>
          </div>
          <Link to={`/members/${m.member_id}/card`}>
            <Button className="btn-pill bg-[hsl(149,40%,30%)] hover:bg-[hsl(149,40%,25%)]" data-testid="open-membership-card-btn">
              <IdCard size={14} className="mr-2"/> Membership card
            </Button>
          </Link>
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="clay-card p-6">
          <h3 className="font-display font-bold mb-4">Contact</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2"><Mail size={14}/>{m.email || "—"}</div>
            <div className="flex items-center gap-2"><Phone size={14}/>{m.phone || "—"}</div>
            <div className="flex items-center gap-2"><Calendar size={14}/>{m.dob || "—"}</div>
            <div className="flex items-center gap-2"><User size={14}/>{m.gender || "—"}</div>
          </div>
          <h4 className="font-display font-bold mt-6 mb-2">Guardian</h4>
          <div className="text-sm space-y-1">
            <div>{m.guardian_name || "—"}</div>
            <div className="text-muted-foreground">{m.guardian_phone}</div>
          </div>
          <h4 className="font-display font-bold mt-6 mb-2 flex items-center gap-2"><Shield size={14}/> Emergency</h4>
          <div className="text-sm">{m.emergency_contact || "—"}</div>
        </Card>

        <Card className="clay-card p-6 lg:col-span-2">
          <h3 className="font-display font-bold mb-4">Attendance</h3>
          <div className="grid grid-cols-4 gap-3 mb-4">
            {["present", "absent", "late", "excused"].map(s => (
              <div key={s} className="p-3 rounded-xl bg-muted/50 text-center">
                <div className="text-2xl font-black font-display">{attStats[s] || 0}</div>
                <div className="uppercase-label mt-1">{s}</div>
              </div>
            ))}
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {(m.attendance || []).map(a => (
              <div key={a.attendance_id} className="flex items-center justify-between text-sm p-2 border-b border-border last:border-0">
                <div>{a.date?.slice(0,10)}</div>
                <Badge variant="outline" className="rounded-full">{a.status}</Badge>
              </div>
            ))}
            {!m.attendance?.length && <div className="text-sm text-muted-foreground">No attendance records yet.</div>}
          </div>
        </Card>
      </div>

      <Card className="clay-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold">Badges</h3>
          {isLeader && (
            <Button size="sm" onClick={() => setAssignOpen(true)} className="btn-pill bg-[hsl(12,65%,63%)] hover:bg-[hsl(12,70%,55%)] h-8" data-testid="assign-badge-btn">
              <Plus size={12} className="mr-1"/> Assign badge
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-8">
          {(m.badges || []).map(mb => {
            const b = badgeById(mb.badge_id);
            if (!b) return null;
            const total = b.requirements?.length || 1;
            const done = (mb.completed_requirements || []).filter(Boolean).length;
            const pct = Math.round(done / total * 100);
            const status = mb.status || (mb.awarded ? "awarded" : "in_progress");
            const canTrack = isLeader && status === "in_progress";
            return (
              <div key={mb.mb_id} className="text-center" data-testid={`mbr-badge-${mb.badge_id}`}>
                <button
                  type="button"
                  onClick={canTrack ? () => openTrack(mb, b) : undefined}
                  className={`inline-block ${canTrack ? "hover:scale-105 transition-transform cursor-pointer" : ""}`}
                  data-testid={`open-progress-${mb.badge_id}`}
                >
                  <BadgePatch badge={b} awarded={mb.awarded} progress={pct} />
                </button>
                <div className="text-xs font-semibold mt-2 max-w-[96px] mx-auto">{b.name}</div>
                {status === "awarded" && <div className="text-[10px] uppercase tracking-widest text-[hsl(149,40%,30%)] font-bold mt-0.5">Awarded</div>}
                {status === "in_progress" && (
                  <div className="text-[10px] uppercase tracking-widest text-[hsl(12,65%,55%)] font-bold mt-0.5">
                    {done} / {total} · {pct}%
                  </div>
                )}
                {status === "requested" && <div className="text-[10px] uppercase tracking-widest text-[hsl(32,87%,55%)] font-bold mt-0.5">Awaiting approval</div>}
                {canTrack && (
                  <button
                    onClick={() => openTrack(mb, b)}
                    className="text-[10px] mt-1 text-[hsl(12,65%,55%)] hover:underline font-bold"
                    data-testid={`track-badge-${mb.badge_id}`}
                  >Track progress</button>
                )}
              </div>
            );
          })}
          {!m.badges?.length && <div className="text-sm text-muted-foreground">No badges yet.</div>}
        </div>
      </Card>

      <Dialog open={!!tracking} onOpenChange={(o) => { if (!o) setTracking(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="badge-progress-dialog">
          {tracking && (() => {
            const reqs = tracking.badge.requirements || [];
            const done = (tracking.mb.completed_requirements || []).filter(Boolean).length;
            const total = reqs.length || 1;
            const pct = Math.round(done / total * 100);
            const allDone = done === total && total > 0;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <BadgePatch badge={tracking.badge} awarded size={40}/>
                    <span>{tracking.badge.name}</span>
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">{tracking.badge.description}</p>

                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="uppercase-label">Progress</span>
                      <span className="font-bold">{done} of {total} · {pct}%</span>
                    </div>
                    <Progress value={pct} className="h-2"/>
                  </div>

                  <div className="space-y-2">
                    <div className="uppercase-label">Requirements</div>
                    {reqs.length === 0 && <div className="text-sm text-muted-foreground">This badge has no requirements yet — ask a national admin to edit it.</div>}
                    {reqs.map((r, i) => {
                      const checked = (tracking.mb.completed_requirements || [])[i] === true;
                      return (
                        <label key={i} className="flex items-start gap-3 p-3 rounded-xl border border-border cursor-pointer hover:bg-muted/50" data-testid={`req-row-${i}`}>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => toggleRequirement(tracking.badge.badge_id, i, !!v)}
                            className="mt-0.5"
                            data-testid={`req-check-${i}`}
                          />
                          <div className="flex-1 text-sm">
                            <div className={checked ? "line-through text-muted-foreground" : ""}>{r}</div>
                          </div>
                          {checked && <CheckCircle2 size={16} className="text-[hsl(149,40%,30%)] mt-0.5"/>}
                        </label>
                      );
                    })}
                  </div>

                  {allDone ? (
                    <Button
                      onClick={async () => { await award(tracking.badge.badge_id); setTracking(null); }}
                      className="btn-pill w-full bg-[hsl(149,40%,30%)] hover:bg-[hsl(149,40%,25%)]"
                      data-testid="mark-awarded-btn"
                    >
                      <CheckCircle2 size={14} className="mr-2"/> All done — mark awarded
                    </Button>
                  ) : (
                    <div className="rounded-xl bg-muted p-3 text-xs text-muted-foreground text-center">
                      Complete all requirements to award this badge.
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Assign a badge</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Pick a badge for <b>{m.full_name}</b> to start working on. They'll get a notification.</p>
            <Select value={assignBid} onValueChange={setAssignBid}>
              <SelectTrigger data-testid="assign-badge-select"><SelectValue placeholder="Choose a badge"/></SelectTrigger>
              <SelectContent>
                {availableBadges.length === 0 && <div className="p-3 text-sm text-muted-foreground">No available badges — this scout has all of them.</div>}
                {availableBadges.map(b => (
                  <SelectItem key={b.badge_id} value={b.badge_id}>
                    {b.name} · {b.section} · {b.difficulty}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={assign} disabled={!assignBid} className="btn-pill w-full bg-[hsl(149,40%,30%)]" data-testid="assign-badge-submit">Assign</Button>
          </div>
        </DialogContent>
      </Dialog>

      {m.notes && (
        <Card className="clay-card p-6">
          <h3 className="font-display font-bold mb-2">Notes</h3>
          <p className="text-sm text-muted-foreground">{m.notes}</p>
        </Card>
      )}
    </div>
  );
}
