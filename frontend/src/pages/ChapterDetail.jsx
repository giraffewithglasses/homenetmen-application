import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Building2, MapPin, Users, Mail, Phone, ArrowLeft, Pencil, UserPlus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ChapterDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [c, setC] = useState(null);
  const [members, setMembers] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({});
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promoteMember, setPromoteMember] = useState("");
  const [promotePosition, setPromotePosition] = useState("Scout Leader");

  const load = () => {
    api.get(`/chapters/${id}`).then(r => { setC(r.data); setForm(r.data); });
    api.get(`/members?chapter_id=${id}`).then(r => setMembers(r.data));
    api.get(`/programs?chapter_id=${id}`).then(r => setPrograms(r.data));
  };
  useEffect(() => { load(); }, [id]);

  const canEdit = user?.role === "national_admin" || (user?.role === "chapter_admin" && user?.chapter_id === id);

  const promote = async () => {
    if (!promoteMember) return toast.error("Choose a member");
    try {
      const { data } = await api.post(`/chapters/${id}/promote-member`, { member_id: promoteMember, position: promotePosition });
      toast.success(`Promoted to ${data.position}${data.linked_user ? " · user role synced" : ""}`);
      setPromoteOpen(false); setPromoteMember(""); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const save = async () => {
    try {
      const payload = {
        name: form.name || "", name_hy: form.name_hy || "", location: form.location || "",
        description: form.description || "", contact_email: form.contact_email || "",
        contact_phone: form.contact_phone || "", logo: form.logo || "", cover: form.cover || "",
      };
      await api.put(`/chapters/${id}`, payload);
      toast.success("Updated");
      setEditOpen(false); load();
    } catch { toast.error("Failed"); }
  };

  if (!c) return <div>Loading…</div>;

  return (
    <div className="space-y-6">
      <Link to="/chapters" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={14} /> All chapters</Link>

      <Card className="clay-card p-8 relative overflow-hidden" style={{
        backgroundImage: "linear-gradient(120deg, hsl(152 43% 15% / 0.92), hsl(149 40% 30% / 0.75)), url('https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?crop=entropy&cs=srgb&fm=jpg&q=85')",
        backgroundSize: "cover", color: "white", border: "none",
      }}>
        {canEdit && (
          <Button
            onClick={() => setEditOpen(true)}
            className="absolute top-4 right-4 btn-pill bg-white/15 hover:bg-white/25 border border-white/30 text-white h-9"
            data-testid="edit-chapter-btn"
          ><Pencil size={14} className="mr-2"/>Edit</Button>
        )}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center bg-[hsl(12,65%,63%)] shadow-inner border-2 border-white/30">
            <Building2 size={26} />
          </div>
          <div>
            <div className="uppercase-label" style={{ color: "hsl(32 87% 75%)" }}>Chapter</div>
            <h1 className="font-display text-3xl lg:text-5xl font-black">{c.name}</h1>
            <div className="text-white/80">{c.name_hy}</div>
          </div>
        </div>
        <p className="mt-6 text-white/85 max-w-2xl">{c.description}</p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <span className="inline-flex items-center gap-2"><MapPin size={14} /> {c.location}</span>
          <span className="inline-flex items-center gap-2"><Mail size={14} /> {c.contact_email}</span>
          <span className="inline-flex items-center gap-2"><Phone size={14} /> {c.contact_phone}</span>
          <span className="inline-flex items-center gap-2"><Users size={14} /> {c.member_count} members</span>
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="clay-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-xl">Leadership</h3>
            {canEdit && (
              <Button size="sm" className="btn-pill bg-[hsl(12,65%,63%)] hover:bg-[hsl(12,70%,55%)] h-8" onClick={() => setPromoteOpen(true)} data-testid="promote-member-btn">
                <UserPlus size={14} className="mr-1"/> Add leader
              </Button>
            )}
          </div>
          <div className="space-y-3">
            {(c.leaders || []).map(l => (
              <div key={l.user_id} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[hsl(149,40%,30%)] text-white flex items-center justify-center font-bold">{l.name?.[0]}</div>
                <div>
                  <div className="font-semibold text-sm">{l.name}</div>
                  <div className="text-xs text-muted-foreground">{l.role.replace("_"," ")}</div>
                </div>
              </div>
            ))}
            {!c.leaders?.length && <div className="text-sm text-muted-foreground">No leaders assigned yet.</div>}
          </div>
        </Card>

        <Card className="clay-card p-6 lg:col-span-2">
          <h3 className="font-display font-bold text-xl mb-4">Upcoming programs</h3>
          <div className="space-y-3">
            {programs.slice(0, 5).map(p => (
              <Link to={`/programs/${p.program_id}`} key={p.program_id} className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/60">
                <div>
                  <div className="font-semibold">{p.title}</div>
                  <div className="text-xs text-muted-foreground">{p.date} · {p.location}</div>
                </div>
                <Badge className="rounded-full bg-[hsl(149,40%,30%)]">{p.section}</Badge>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <Card className="clay-card p-6">
        <h3 className="font-display font-bold text-xl mb-4">Members ({members.length})</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {members.slice(0, 12).map(m => (
            <Link to={`/members/${m.member_id}`} key={m.member_id} className="p-3 rounded-xl border border-border hover:bg-muted/50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[hsl(12,65%,63%)]/20 text-[hsl(12,65%,63%)] flex items-center justify-center font-bold">{m.full_name[0]}</div>
              <div>
                <div className="font-semibold text-sm">{m.full_name}</div>
                <div className="text-xs text-muted-foreground">{m.section} · {m.patrol}</div>
              </div>
            </Link>
          ))}
        </div>
      </Card>

      <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Promote member to leader</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Pick a member from this chapter's roster and assign a leadership role. Their linked user account will be upgraded automatically.</p>
            <div>
              <Label>Member</Label>
              <Select value={promoteMember} onValueChange={setPromoteMember}>
                <SelectTrigger data-testid="promote-member-select"><SelectValue placeholder="Choose a member"/></SelectTrigger>
                <SelectContent>
                  {members.filter(m => m.status !== "archived").map(m => (
                    <SelectItem key={m.member_id} value={m.member_id}>
                      {m.full_name} · {m.section} {m.position && m.position !== "Member" ? `(${m.position})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Position</Label>
              <Select value={promotePosition} onValueChange={setPromotePosition}>
                <SelectTrigger data-testid="promote-position-select"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Patrol Co-Leader">Patrol Co-Leader</SelectItem>
                  <SelectItem value="Patrol Leader">Patrol Leader</SelectItem>
                  <SelectItem value="Cubs Leader">Cubs Leader</SelectItem>
                  <SelectItem value="Scout Leader">Scout Leader</SelectItem>
                  <SelectItem value="Chapter Leader">Chapter Leader</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={promote} className="btn-pill w-full bg-[hsl(149,40%,30%)]" data-testid="promote-submit">Promote</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Chapter</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name || ""} onChange={e => setForm({...form, name: e.target.value})} data-testid="edit-chp-name"/></div>
            <div><Label>Name (Armenian)</Label><Input value={form.name_hy || ""} onChange={e => setForm({...form, name_hy: e.target.value})}/></div>
            <div><Label>Location</Label><Input value={form.location || ""} onChange={e => setForm({...form, location: e.target.value})}/></div>
            <div><Label>Description</Label><Textarea value={form.description || ""} onChange={e => setForm({...form, description: e.target.value})}/></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input value={form.contact_email || ""} onChange={e => setForm({...form, contact_email: e.target.value})}/></div>
              <div><Label>Phone</Label><Input value={form.contact_phone || ""} onChange={e => setForm({...form, contact_phone: e.target.value})}/></div>
            </div>
            <Button onClick={save} className="btn-pill w-full bg-[hsl(149,40%,30%)]" data-testid="edit-chp-save">Save changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
