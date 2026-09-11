import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Plus, Archive, ArchiveRestore, CheckCircle2, XCircle, Clock, Pencil, Award } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import BadgePatch from "@/components/BadgePatch";

const LEADER_ROLES = ["national_admin", "chapter_admin", "chapter_leader", "scout_leader", "cubs_leader", "patrol_leader", "patrol_co_leader"];
const SECTIONS = ["Cubs", "Scouts", "Senior Scouts", "Rovers"];
const CATEGORIES = ["Scouting Skills", "Camping", "Hiking", "First Aid", "Leadership", "Nature", "Community Service", "Communication", "Navigation", "Sports", "Creativity", "Citizenship"];

export default function Badges() {
  const { user } = useAuth();
  const [badges, setBadges] = useState([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({
    name: "", name_hy: "", icon: "star", icon_image: "", color: "#2D6A4F", description: "",
    section: "Scouts", category: "Scouting Skills", difficulty: "medium",
    recommended_age: "12+", requirements: [],
  });
  const [reqInput, setReqInput] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [requests, setRequests] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [selectedReqs, setSelectedReqs] = useState(new Set());
  const [decision, setDecision] = useState(null); // { ids: [], action: 'approve'|'deny', mode?: 'in_progress'|'awarded' }
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const emptyForm = () => ({
    name: "", name_hy: "", icon: "star", icon_image: "", color: "#2D6A4F", description: "",
    section: "Scouts", category: "Scouting Skills", difficulty: "medium",
    recommended_age: "12+", requirements: [],
  });

  const isLeader = LEADER_ROLES.includes(user?.role);

  const load = () => api.get(`/badges?include_archived=${showArchived}`).then(r => setBadges(r.data));
  const loadRequests = () => {
    if (!isLeader) return;
    api.get("/badges/requests")
      .then(r => { setRequests(r.data); setSelectedReqs(new Set()); })
      .catch(() => setRequests([]));
  };
  useEffect(() => { load(); loadRequests(); /* eslint-disable-next-line */ }, [showArchived, user?.role]);

  const notifySidebar = () => {
    try { window.dispatchEvent(new CustomEvent("badge-requests-changed")); } catch (err) { /* noop */ }
  };

  const toggleOne = (mb_id, checked) => {
    const n = new Set(selectedReqs);
    if (checked) n.add(mb_id); else n.delete(mb_id);
    setSelectedReqs(n);
  };
  const toggleAllReqs = (checked) => {
    if (checked) setSelectedReqs(new Set(requests.map(r => r.mb_id)));
    else setSelectedReqs(new Set());
  };

  const openDecision = (ids, action, mode) => {
    setDecision({ ids, action, mode });
    setNote("");
  };
  const closeDecision = () => { setDecision(null); setNote(""); };

  const submitDecision = async () => {
    if (!decision) return;
    setSubmitting(true);
    try {
      const { ids, action, mode } = decision;
      const trimmed = note.trim();
      if (ids.length === 1) {
        const mb_id = ids[0];
        const params = action === "approve" ? `?mode=${mode || "in_progress"}` : "";
        await api.post(`/badges/requests/${mb_id}/${action}${params}`, { note: trimmed });
        toast.success(action === "approve"
          ? (mode === "awarded" ? "Badge awarded" : "Request approved — scout can start")
          : "Request declined");
      } else {
        const { data } = await api.post(`/badges/requests/bulk`, {
          mb_ids: ids, action, mode: mode || "in_progress", note: trimmed,
        });
        const ok = data?.processed || 0;
        const fail = ids.length - ok;
        if (fail === 0) toast.success(`${ok} request${ok === 1 ? "" : "s"} processed`);
        else toast(`Processed ${ok}, skipped ${fail}`, { description: "Some entries were no longer pending or out of your chapter." });
      }
      loadRequests();
      notifySidebar();
      closeDecision();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const save = async () => {
    try {
      if (editingId) {
        await api.put(`/badges/${editingId}`, form);
        toast.success("Badge updated");
      } else {
        await api.post("/badges", form);
        toast.success("Badge created");
      }
      setOpen(false); setEditingId(null); setForm(emptyForm()); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };
  const openEdit = (b) => {
    setEditingId(b.badge_id);
    setForm({
      name: b.name || "", name_hy: b.name_hy || "", icon: b.icon || "star",
      icon_image: b.icon_image || "", color: b.color || "#2D6A4F",
      description: b.description || "", section: b.section || "Scouts",
      category: b.category || "Scouting Skills", difficulty: b.difficulty || "medium",
      recommended_age: b.recommended_age || "12+", requirements: b.requirements || [],
    });
    setOpen(true);
  };
  const openNew = () => { setEditingId(null); setForm(emptyForm()); setOpen(true); };
  const archive = async (bid, archived) => {
    try {
      await api.post(`/badges/${bid}/${archived ? "unarchive" : "archive"}`);
      toast.success(archived ? "Restored" : "Archived");
      load();
    } catch { toast.error("Failed"); }
  };
  const addReq = () => { if (reqInput.trim()) { setForm({...form, requirements: [...form.requirements, reqInput.trim()]}); setReqInput(""); } };

  const filtered = filter === "all" ? badges : badges.filter(b => b.category === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="uppercase-label">Progress</div>
          <h1 className="font-display text-4xl lg:text-5xl font-black tracking-tight mt-1">Progress Badges</h1>
          <p className="text-muted-foreground mt-1">Skills, adventures and merit.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {user?.role === "national_admin" && (
            <label className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold cursor-pointer">
              <Switch checked={showArchived} onCheckedChange={setShowArchived} data-testid="bdg-show-archived"/>
              Show archived
            </label>
          )}
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Category"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          {user?.role === "national_admin" && (
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditingId(null); setForm(emptyForm()); } }}>
              <DialogTrigger asChild>
                <Button className="btn-pill bg-[hsl(12,65%,63%)]" onClick={openNew} data-testid="new-badge-btn"><Plus size={16} className="mr-2"/>New Badge</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editingId ? "Edit Badge" : "New Badge"}</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} data-testid="bdg-name"/></div>
                  <div><Label>Name (Armenian)</Label><Input value={form.name_hy} onChange={e => setForm({...form, name_hy: e.target.value})}/></div>
                  <div className="col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}/></div>
                  <div className="col-span-2">
                    <Label>Badge image</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <BadgePatch badge={form} awarded size={64}/>
                      <div className="flex-1 space-y-2">
                        <Input
                          type="file"
                          accept="image/*"
                          data-testid="bdg-image-input"
                          onChange={(e) => {
                            const f = e.target.files?.[0]; if (!f) return;
                            if (f.size > 1024 * 1024) return toast.error("Image must be under 1 MB");
                            const r = new FileReader();
                            r.onload = () => setForm({...form, icon_image: r.result});
                            r.readAsDataURL(f);
                          }}
                        />
                        {form.icon_image && (
                          <button
                            type="button"
                            onClick={() => setForm({...form, icon_image: ""})}
                            className="text-xs uppercase tracking-widest font-bold text-[hsl(0,65%,55%)]"
                            data-testid="bdg-image-clear"
                          >Remove image</button>
                        )}
                        <p className="text-xs text-muted-foreground">Upload a square image (PNG/JPG, &lt;1&nbsp;MB). Leave empty to use the color badge below.</p>
                      </div>
                    </div>
                  </div>
                  <div><Label>Fallback color</Label><Input type="color" value={form.color} onChange={e => setForm({...form, color: e.target.value})}/></div>
                  <div><Label>Section</Label>
                    <Select value={form.section} onValueChange={v => setForm({...form, section: v})}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>{SECTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Category</Label>
                    <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Difficulty</Label>
                    <Select value={form.difficulty} onValueChange={v => setForm({...form, difficulty: v})}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Recommended age</Label><Input value={form.recommended_age} onChange={e => setForm({...form, recommended_age: e.target.value})}/></div>
                  <div className="col-span-2">
                    <Label>Requirements</Label>
                    <div className="flex gap-2">
                      <Input value={reqInput} onChange={e => setReqInput(e.target.value)} placeholder="Add a requirement…"/>
                      <Button type="button" onClick={addReq}>Add</Button>
                    </div>
                    <ul className="mt-2 text-sm space-y-1">
                      {form.requirements.map((r, i) => <li key={i} className="flex items-center gap-2">• {r}</li>)}
                    </ul>
                  </div>
                </div>
                <Button onClick={save} className="btn-pill w-full bg-[hsl(149,40%,30%)] mt-2" data-testid="bdg-save">{editingId ? "Save changes" : "Create Badge"}</Button>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {isLeader && requests.length > 0 && (
        <Card className="clay-card p-6 border-l-4 border-l-[hsl(32,87%,55%)]" data-testid="badge-requests-card">
          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-[hsl(32,87%,55%)]"/>
              <h3 className="font-display font-bold text-xl">Pending badge requests <span className="text-muted-foreground font-normal">({requests.length})</span></h3>
            </div>
            <label className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold cursor-pointer select-none">
              <Checkbox
                checked={selectedReqs.size > 0 && selectedReqs.size === requests.length}
                onCheckedChange={toggleAllReqs}
                data-testid="badge-requests-select-all"
              />
              Select all
            </label>
          </div>

          {selectedReqs.size > 0 && (
            <div className="mb-4 p-3 rounded-xl bg-[hsl(32,87%,55%)]/10 border border-[hsl(32,87%,55%)]/40 flex flex-wrap items-center gap-2" data-testid="badge-requests-bulk-bar">
              <span className="text-sm font-bold mr-2">{selectedReqs.size} selected</span>
              <Button size="sm" onClick={() => openDecision(Array.from(selectedReqs), "approve", "in_progress")} className="btn-pill bg-[hsl(149,40%,30%)] hover:bg-[hsl(149,40%,25%)]" data-testid="bulk-approve-start">
                <CheckCircle2 size={12} className="mr-1"/> Approve to start
              </Button>
              <Button size="sm" onClick={() => openDecision(Array.from(selectedReqs), "approve", "awarded")} className="btn-pill bg-[hsl(32,87%,55%)] hover:bg-[hsl(32,87%,45%)] text-[hsl(155,60%,8%)]" data-testid="bulk-award">
                <Award size={12} className="mr-1"/> Award now
              </Button>
              <Button size="sm" variant="ghost" onClick={() => openDecision(Array.from(selectedReqs), "deny")} className="btn-pill text-[hsl(0,65%,55%)] hover:bg-[hsl(0,65%,55%)]/10" data-testid="bulk-deny">
                <XCircle size={12} className="mr-1"/> Deny
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedReqs(new Set())} className="btn-pill ml-auto" data-testid="bulk-clear">Clear</Button>
            </div>
          )}

          <div className="space-y-3">
            {requests.map(r => (
              <div key={r.mb_id} className="flex items-center gap-3 p-3 rounded-xl border border-border" data-testid={`badge-request-${r.mb_id}`}>
                <Checkbox
                  checked={selectedReqs.has(r.mb_id)}
                  onCheckedChange={(v) => toggleOne(r.mb_id, !!v)}
                  data-testid={`badge-request-check-${r.mb_id}`}
                />
                <BadgePatch badge={r.badge} awarded size={48}/>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{r.member?.full_name || "Unknown scout"}</div>
                  <div className="text-xs text-muted-foreground truncate">wants to start <b>{r.badge?.name}</b> · {r.member?.section}</div>
                </div>
                <div className="flex flex-wrap gap-2 flex-shrink-0 justify-end">
                  <Button size="sm" onClick={() => openDecision([r.mb_id], "approve", "in_progress")} className="btn-pill bg-[hsl(149,40%,30%)] hover:bg-[hsl(149,40%,25%)]" data-testid={`badge-request-approve-${r.mb_id}`}>
                    <CheckCircle2 size={12} className="mr-1"/> Approve to start
                  </Button>
                  <Button size="sm" onClick={() => openDecision([r.mb_id], "approve", "awarded")} className="btn-pill bg-[hsl(32,87%,55%)] hover:bg-[hsl(32,87%,45%)] text-[hsl(155,60%,8%)]" data-testid={`badge-request-award-${r.mb_id}`}>
                    <Award size={12} className="mr-1"/> Award now
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openDecision([r.mb_id], "deny")} className="btn-pill text-[hsl(0,65%,55%)] hover:bg-[hsl(0,65%,55%)]/10" data-testid={`badge-request-deny-${r.mb_id}`}>
                    <XCircle size={12} className="mr-1"/> Deny
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Approve/Deny confirmation with optional coaching note */}
      <Dialog open={!!decision} onOpenChange={(o) => !o && closeDecision()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle data-testid="badge-decision-title">
              {decision?.action === "deny"
                ? `Deny ${decision.ids.length} badge request${decision.ids.length === 1 ? "" : "s"}`
                : decision?.mode === "awarded"
                  ? `Award badge${decision.ids.length === 1 ? "" : "s"} now (${decision.ids.length})`
                  : `Approve ${decision?.ids.length} request${decision?.ids.length === 1 ? "" : "s"} to start`}
            </DialogTitle>
          </DialogHeader>
          {decision && (
            <div className="space-y-3">
              {decision.action === "approve" && decision.mode === "awarded" && (
                <p className="text-sm text-muted-foreground">
                  This marks every requirement complete and awards the badge immediately. The scout will get a congratulations notification.
                </p>
              )}
              {decision.action === "approve" && decision.mode === "in_progress" && (
                <p className="text-sm text-muted-foreground">
                  The scout will be able to start working through the requirements. You can mark them off later.
                </p>
              )}
              {decision.action === "deny" && (
                <p className="text-sm text-muted-foreground">
                  The request will be removed and the scout will be notified. A note is a good way to coach them.
                </p>
              )}
              {decision.ids.length > 1 && (
                <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-2">
                  Same note (if any) will be sent to all {decision.ids.length} scouts.
                </div>
              )}
              <div>
                <Label>Note to scout <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={decision.action === "deny"
                    ? "e.g. Great effort — let's revisit after First Aid camp in July."
                    : "e.g. Nice initiative — start with the woodwork item this week."}
                  maxLength={400}
                  data-testid="badge-decision-note"
                />
                <div className="text-[10px] text-muted-foreground mt-1 text-right">{note.length}/400</div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={closeDecision} disabled={submitting} data-testid="badge-decision-cancel">Cancel</Button>
                <Button
                  onClick={submitDecision}
                  disabled={submitting}
                  className={`btn-pill ${
                    decision.action === "deny"
                      ? "bg-[hsl(0,65%,55%)] hover:bg-[hsl(0,65%,45%)]"
                      : decision.mode === "awarded"
                        ? "bg-[hsl(32,87%,55%)] hover:bg-[hsl(32,87%,45%)] text-[hsl(155,60%,8%)]"
                        : "bg-[hsl(149,40%,30%)] hover:bg-[hsl(149,40%,25%)]"
                  }`}
                  data-testid="badge-decision-confirm"
                >
                  {submitting ? "Working…" : (
                    decision.action === "deny" ? "Deny & notify"
                      : decision.mode === "awarded" ? "Award now"
                      : "Approve"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(b => (
          <Card key={b.badge_id} className={`clay-card p-6 hover-lift relative ${b.archived ? "opacity-60" : ""}`}>
            {user?.role === "national_admin" && (
              <div className="absolute top-3 right-3 flex gap-1">
                <button
                  onClick={() => openEdit(b)}
                  className="w-8 h-8 rounded-full text-muted-foreground hover:bg-[hsl(12,65%,63%)]/20 hover:text-[hsl(12,65%,63%)] flex items-center justify-center"
                  data-testid={`edit-bdg-${b.badge_id}`}
                  title="Edit badge"
                ><Pencil size={14}/></button>
                <button
                  onClick={() => archive(b.badge_id, b.archived)}
                  className="w-8 h-8 rounded-full text-muted-foreground hover:bg-[hsl(32,87%,67%)]/20 hover:text-[hsl(32,87%,55%)] flex items-center justify-center"
                  data-testid={`archive-bdg-${b.badge_id}`}
                  title={b.archived ? "Unarchive" : "Archive"}
                >
                  {b.archived ? <ArchiveRestore size={14}/> : <Archive size={14}/>}
                </button>
              </div>
            )}
            <div className="flex items-start gap-4">
              <BadgePatch badge={b} awarded />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="rounded-full">{b.section}</Badge>
                  <Badge className="rounded-full bg-[hsl(32,87%,67%)] text-[hsl(155,60%,8%)]">{b.difficulty}</Badge>
                </div>
                <div className="font-display font-bold text-lg mt-2">{b.name}</div>
                <div className="text-xs text-muted-foreground">{b.name_hy}</div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-3">{b.description}</p>
            <div className="uppercase-label mt-4">Requirements ({b.requirements?.length || 0})</div>
            <ul className="mt-2 text-sm space-y-1">
              {(b.requirements || []).slice(0, 3).map((r, i) => <li key={i}>• {r}</li>)}
              {b.requirements?.length > 3 && <li className="text-muted-foreground">+ {b.requirements.length - 3} more…</li>}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
