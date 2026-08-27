import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Plus, MapPin, Clock, Copy, CalendarDays, Trash2, Users, CheckCircle2 } from "lucide-react";

const SECTIONS = ["Cubs", "Scouts", "Senior Scouts", "Rovers"];
const LEADER_ROLES = ["national_admin", "chapter_admin", "chapter_leader", "scout_leader", "cubs_leader", "patrol_leader", "patrol_co_leader"];
const LEVEL_STYLE = {
  national: { bg: "hsl(32 87% 67%)", fg: "hsl(155 60% 8%)", label: "National" },
  regional: { bg: "hsl(12 65% 63%)", fg: "white", label: "Regional" },
  chapter: { bg: "hsl(149 40% 30%)", fg: "white", label: "Chapter" },
};

const emptyForm = {
  title: "", title_hy: "", description: "", date: "", start_time: "10:00",
  end_time: "13:00", location: "", section: "Scouts", sections: ["Scouts"],
  level: "chapter", expected_participants: 20, capacity: 0, waitlist_enabled: false,
  materials: "", objectives: "", activities: [],
};

export default function Programs() {
  const { user } = useAuth();
  const [programs, setPrograms] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [myRegs, setMyRegs] = useState({}); // {program_id: status}

  const load = async () => {
    const { data } = await api.get("/programs");
    setPrograms(data);
    if (user?.role === "scout") {
      const map = {};
      await Promise.all(data.map(async p => {
        try {
          const r = await api.get(`/programs/${p.program_id}/my-registration`);
          if (r.data.status && r.data.status !== "none") map[p.program_id] = r.data.status;
        } catch {}
      }));
      setMyRegs(map);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const canManage = user?.role && LEADER_ROLES.includes(user.role);
  const canPickLevel = user?.role === "national_admin";

  const save = async () => {
    try { await api.post("/programs", form); toast.success("Program created"); setOpen(false); setForm(emptyForm); load(); }
    catch { toast.error("Failed"); }
  };
  const dup = async (id) => {
    try { await api.post(`/programs/${id}/duplicate`); toast.success("Duplicated"); load(); }
    catch { toast.error("Failed"); }
  };
  const remove = async (id) => {
    if (!window.confirm("Delete this program?")) return;
    try { await api.delete(`/programs/${id}`); toast.success("Deleted"); load(); }
    catch { toast.error("Failed"); }
  };
  const register = async (p) => {
    try {
      const { data } = await api.post(`/programs/${p.program_id}/register`);
      setMyRegs({ ...myRegs, [p.program_id]: data.status });
      if (data.status === "waitlisted") toast(`You're on the waitlist for ${p.title}`);
      else toast.success(`Registered for ${p.title}`);
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };
  const unregister = async (p) => {
    try {
      await api.delete(`/programs/${p.program_id}/register`);
      const m = { ...myRegs }; delete m[p.program_id];
      setMyRegs(m);
      toast.success("You've been removed");
      load();
    } catch { toast.error("Failed"); }
  };

  const toggleSection = (s) => {
    const has = form.sections.includes(s);
    setForm({ ...form, sections: has ? form.sections.filter(x => x !== s) : [...form.sections, s] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="uppercase-label">Programs & Activities</div>
          <h1 className="font-display text-4xl lg:text-5xl font-black tracking-tight mt-1">Programs</h1>
          <p className="text-muted-foreground mt-1">National, regional and chapter programs.</p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="btn-pill bg-[hsl(12,65%,63%)]" data-testid="new-program-btn"><Plus size={16} className="mr-2"/>New Program</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>New Program</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Title</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} data-testid="prg-title"/></div>
                <div className="col-span-2"><Label>Title (Armenian)</Label><Input value={form.title_hy} onChange={e => setForm({...form, title_hy: e.target.value})}/></div>
                <div className="col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}/></div>
                <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})}/></div>
                <div><Label>Location</Label><Input value={form.location} onChange={e => setForm({...form, location: e.target.value})}/></div>
                <div><Label>Start time</Label><Input type="time" value={form.start_time} onChange={e => setForm({...form, start_time: e.target.value})}/></div>
                <div><Label>End time</Label><Input type="time" value={form.end_time} onChange={e => setForm({...form, end_time: e.target.value})}/></div>

                {canPickLevel && (
                  <div className="col-span-2">
                    <Label>Level</Label>
                    <div className="flex gap-2 mt-2">
                      {Object.entries(LEVEL_STYLE).map(([k, v]) => (
                        <button
                          key={k} type="button"
                          onClick={() => setForm({...form, level: k})}
                          className={`px-4 py-2 rounded-full text-xs uppercase tracking-widest font-bold transition-colors ${form.level === k ? "text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
                          style={form.level === k ? { background: v.bg, color: v.fg } : {}}
                          data-testid={`prg-level-${k}`}
                        >{v.label}</button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Chapter-level programs are visible only to that chapter; regional and national are visible to everyone.</p>
                  </div>
                )}

                <div className="col-span-2">
                  <Label>Age sections (who is this for)</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {SECTIONS.map(s => {
                      const active = form.sections.includes(s);
                      return (
                        <button
                          key={s} type="button"
                          onClick={() => toggleSection(s)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${active ? "bg-[hsl(149,40%,30%)] text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
                          data-testid={`prg-section-${s.replace(/\s/g,"-")}`}
                        >{s}</button>
                      );
                    })}
                  </div>
                </div>

                <div><Label>Capacity (0 = unlimited)</Label><Input type="number" min="0" value={form.capacity} onChange={e => setForm({...form, capacity: Number(e.target.value)})} data-testid="prg-capacity"/></div>
                <div className="flex items-end">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Switch checked={form.waitlist_enabled} onCheckedChange={v => setForm({...form, waitlist_enabled: v})} data-testid="prg-waitlist"/>
                    <span className="text-sm font-semibold">Enable waitlist</span>
                  </label>
                </div>

                <div><Label>Expected participants</Label><Input type="number" value={form.expected_participants} onChange={e => setForm({...form, expected_participants: Number(e.target.value)})}/></div>
                <div className="col-span-2"><Label>Materials</Label><Input value={form.materials} onChange={e => setForm({...form, materials: e.target.value})}/></div>
                <div className="col-span-2"><Label>Objectives</Label><Textarea value={form.objectives} onChange={e => setForm({...form, objectives: e.target.value})}/></div>
              </div>
              <Button onClick={save} className="btn-pill w-full bg-[hsl(149,40%,30%)] mt-2" data-testid="prg-save">Create</Button>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {programs.map(p => {
          const lvl = LEVEL_STYLE[p.level || "chapter"] || LEVEL_STYLE.chapter;
          const secs = (p.sections && p.sections.length ? p.sections : [p.section]).filter(Boolean);
          const mine = myRegs[p.program_id];
          const registered = p.registered_count || 0;
          const cap = p.capacity || 0;
          const full = cap > 0 && registered >= cap;
          return (
            <Card key={p.program_id} className="clay-card overflow-hidden hover-lift">
              <div className="h-32 relative" style={{
                backgroundImage: "linear-gradient(135deg, hsl(149 40% 30% / 0.85), hsl(12 65% 63% / 0.5)), url('https://images.unsplash.com/photo-1600706843784-6f0ad251f52f?crop=entropy&cs=srgb&fm=jpg&q=85')",
                backgroundSize: "cover", backgroundPosition: "center",
              }}>
                <Badge className="absolute top-3 left-3 rounded-full" style={{ background: lvl.bg, color: lvl.fg }}>{lvl.label}</Badge>
                <div className="absolute top-3 right-3 flex flex-wrap justify-end gap-1 max-w-[65%]">
                  {secs.map(s => <Badge key={s} className="rounded-full bg-white/95 text-foreground text-[10px]">{s}</Badge>)}
                </div>
              </div>
              <div className="p-5">
                <Link to={`/programs/${p.program_id}`}>
                  <div className="font-display font-bold text-lg hover:text-[hsl(12,65%,63%)]" data-testid={`prg-title-${p.program_id}`}>{p.title}</div>
                </Link>
                <div className="text-xs text-muted-foreground">{p.title_hy}</div>
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2"><CalendarDays size={12}/>{p.date}</div>
                  <div className="flex items-center gap-2"><Clock size={12}/>{p.start_time} – {p.end_time}</div>
                  <div className="flex items-center gap-2"><MapPin size={12}/>{p.location}</div>
                  {cap > 0 && (
                    <div className="flex items-center gap-2">
                      <Users size={12}/>
                      <span className={full ? "text-[hsl(0,65%,55%)] font-bold" : "font-semibold"}>{registered} / {cap}</span>
                      {p.waitlist_count > 0 && <span className="text-[hsl(32,87%,55%)]">· +{p.waitlist_count} waitlisted</span>}
                    </div>
                  )}
                </div>

                {user?.role === "scout" && (
                  <div className="mt-4">
                    {mine === "registered" && (
                      <div className="flex items-center justify-between">
                        <Badge className="rounded-full bg-[hsl(149,40%,30%)]"><CheckCircle2 size={12} className="mr-1"/> You're in</Badge>
                        <Button size="sm" variant="ghost" onClick={() => unregister(p)} data-testid={`prg-unreg-${p.program_id}`}>Cancel</Button>
                      </div>
                    )}
                    {mine === "waitlisted" && (
                      <div className="flex items-center justify-between">
                        <Badge className="rounded-full bg-[hsl(32,87%,67%)] text-[hsl(155,60%,8%)]">Waitlisted</Badge>
                        <Button size="sm" variant="ghost" onClick={() => unregister(p)} data-testid={`prg-unreg-${p.program_id}`}>Leave</Button>
                      </div>
                    )}
                    {!mine && (
                      <Button size="sm" className="w-full btn-pill bg-[hsl(12,65%,63%)] hover:bg-[hsl(12,70%,55%)]" onClick={() => register(p)} disabled={full && !p.waitlist_enabled} data-testid={`prg-reg-${p.program_id}`}>
                        {full ? (p.waitlist_enabled ? "Join waitlist" : "Full") : "Register"}
                      </Button>
                    )}
                  </div>
                )}

                {canManage && (
                  <div className="mt-3 flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => dup(p.program_id)} data-testid={`dup-prg-${p.program_id}`}><Copy size={12} className="mr-1"/>Duplicate</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(p.program_id)} className="text-[hsl(0,65%,55%)] hover:bg-[hsl(0,65%,55%)]/10" data-testid={`del-prg-${p.program_id}`}><Trash2 size={12} className="mr-1"/>Delete</Button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
