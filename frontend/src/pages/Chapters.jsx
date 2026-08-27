import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Building2, MapPin, Users, Plus, ChevronRight, Mail, Phone } from "lucide-react";

export default function Chapters() {
  const { user } = useAuth();
  const [chapters, setChapters] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", name_hy: "", location: "", description: "", contact_email: "", contact_phone: "" });

  const load = () => api.get("/chapters").then(r => setChapters(r.data));
  useEffect(() => { load(); }, []);

  const save = async () => {
    try { await api.post("/chapters", form); toast.success("Chapter created"); setOpen(false); load(); }
    catch (e) { toast.error("Failed to create chapter"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="uppercase-label">Directory</div>
          <h1 className="font-display text-4xl lg:text-5xl font-black tracking-tight mt-1">Chapters</h1>
          <p className="text-muted-foreground mt-2">Local scouting hubs across the country.</p>
        </div>
        {user?.role === "national_admin" && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="btn-pill bg-[hsl(12,65%,63%)] hover:bg-[hsl(12,70%,55%)]" data-testid="new-chapter-btn"><Plus size={16} className="mr-2" />New Chapter</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>New Chapter</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} data-testid="chp-name" /></div>
                <div><Label>Name (Armenian)</Label><Input value={form.name_hy} onChange={e => setForm({...form, name_hy: e.target.value})} /></div>
                <div><Label>Location</Label><Input value={form.location} onChange={e => setForm({...form, location: e.target.value})} /></div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Email</Label><Input value={form.contact_email} onChange={e => setForm({...form, contact_email: e.target.value})} /></div>
                  <div><Label>Phone</Label><Input value={form.contact_phone} onChange={e => setForm({...form, contact_phone: e.target.value})} /></div>
                </div>
                <Button onClick={save} className="btn-pill w-full bg-[hsl(149,40%,30%)]" data-testid="chp-save">Create</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {chapters.map(c => (
          <Link to={`/chapters/${c.chapter_id}`} key={c.chapter_id}>
            <Card className="clay-card p-6 hover-lift cursor-pointer h-full" data-testid={`chapter-card-${c.chapter_id}`}>
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[hsl(149,40%,30%)] text-white">
                  <Building2 size={22} />
                </div>
                <ChevronRight size={18} className="text-muted-foreground" />
              </div>
              <div className="mt-4 font-display text-xl font-bold">{c.name}</div>
              <div className="text-sm text-muted-foreground">{c.name_hy}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-3"><MapPin size={12} />{c.location}</div>
              <p className="text-sm mt-3 line-clamp-2">{c.description}</p>
              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-sm">
                <div className="flex items-center gap-2"><Users size={14} /> <span className="font-bold">{c.member_count}</span> members</div>
                <div className="text-[hsl(12,65%,63%)] font-bold text-xs uppercase tracking-widest">View →</div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
