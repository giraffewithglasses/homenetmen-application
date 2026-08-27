import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Plus, MapPin, Clock, Copy, CalendarDays } from "lucide-react";

const SECTIONS = ["Cubs", "Scouts", "Senior Scouts", "Rovers"];

export default function Programs() {
  const { user } = useAuth();
  const [programs, setPrograms] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", title_hy: "", description: "", date: "", start_time: "10:00",
    end_time: "13:00", location: "", section: "Scouts", expected_participants: 20,
    materials: "", objectives: "", activities: [],
  });

  const load = () => api.get("/programs").then(r => setPrograms(r.data));
  useEffect(() => { load(); }, []);

  const canManage = user?.role && user.role !== "scout";

  const save = async () => {
    try { await api.post("/programs", form); toast.success("Program created"); setOpen(false); load(); }
    catch { toast.error("Failed"); }
  };
  const dup = async (id) => {
    try { await api.post(`/programs/${id}/duplicate`); toast.success("Duplicated"); load(); }
    catch { toast.error("Failed"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="uppercase-label">Programs & Activities</div>
          <h1 className="font-display text-4xl lg:text-5xl font-black tracking-tight mt-1">Programs</h1>
          <p className="text-muted-foreground mt-1">National and chapter programs.</p>
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
                <div><Label>Section</Label>
                  <Select value={form.section} onValueChange={v => setForm({...form, section: v})}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>{SECTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
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
        {programs.map(p => (
          <Card key={p.program_id} className="clay-card overflow-hidden hover-lift">
            <div className="h-32 relative" style={{
              backgroundImage: "linear-gradient(135deg, hsl(149 40% 30% / 0.85), hsl(12 65% 63% / 0.5)), url('https://images.unsplash.com/photo-1600706843784-6f0ad251f52f?crop=entropy&cs=srgb&fm=jpg&q=85')",
              backgroundSize: "cover", backgroundPosition: "center",
            }}>
              <Badge className="absolute top-3 right-3 rounded-full bg-white/95 text-foreground">{p.section}</Badge>
              {!p.chapter_id && <Badge className="absolute top-3 left-3 rounded-full bg-[hsl(32,87%,67%)] text-[hsl(155,60%,8%)]">National</Badge>}
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
              </div>
              {canManage && (
                <Button size="sm" variant="ghost" className="mt-3" onClick={() => dup(p.program_id)}><Copy size={12} className="mr-1"/>Duplicate</Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
