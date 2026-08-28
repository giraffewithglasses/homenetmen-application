import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Building2, MapPin, Users, Plus, ChevronRight, Archive, ArchiveRestore, Pencil, Image as ImageIcon } from "lucide-react";

export default function Chapters() {
  const { user } = useAuth();
  const [chapters, setChapters] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", name_hy: "", location: "", description: "", contact_email: "", contact_phone: "", logo: "", cover: "" });

  const emptyForm = () => ({ name: "", name_hy: "", location: "", description: "", contact_email: "", contact_phone: "", logo: "", cover: "" });

  const load = () => api.get(`/chapters?include_archived=${showArchived}`).then(r => setChapters(r.data));
  useEffect(() => { load(); }, [showArchived]);

  const openNew = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (c) => { setEditing(c); setForm({
    name: c.name || "", name_hy: c.name_hy || "", location: c.location || "",
    description: c.description || "", contact_email: c.contact_email || "",
    contact_phone: c.contact_phone || "", logo: c.logo || "", cover: c.cover || "",
  }); setOpen(true); };

  const save = async () => {
    try {
      if (editing) {
        await api.put(`/chapters/${editing.chapter_id}`, form);
        toast.success("Chapter updated");
      } else {
        await api.post("/chapters", form);
        toast.success("Chapter created");
      }
      setOpen(false); load();
    } catch { toast.error("Failed"); }
  };
  const archive = async (id, archived) => {
    try {
      await api.post(`/chapters/${id}/${archived ? "unarchive" : "archive"}`);
      toast.success(archived ? "Restored" : "Archived");
      load();
    } catch { toast.error("Failed"); }
  };

  const isAdmin = user?.role === "national_admin";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="uppercase-label">Directory</div>
          <h1 className="font-display text-4xl lg:text-5xl font-black tracking-tight mt-1">Chapters</h1>
          <p className="text-muted-foreground mt-2">Local scouting hubs across the country.</p>
        </div>
        <div className="flex items-center gap-4">
          {isAdmin && (
            <label className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold cursor-pointer">
              <Switch checked={showArchived} onCheckedChange={setShowArchived} data-testid="chp-show-archived"/>
              Show archived
            </label>
          )}
          {isAdmin && (
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
              <DialogTrigger asChild>
                <Button className="btn-pill bg-[hsl(12,65%,63%)] hover:bg-[hsl(12,70%,55%)]" onClick={openNew} data-testid="new-chapter-btn"><Plus size={16} className="mr-2" />New Chapter</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editing ? "Edit Chapter" : "New Chapter"}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Chapter logo</Label>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="w-16 h-16 rounded-full bg-white shadow-inner border-2 border-border p-1 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {form.logo
                          ? <img src={form.logo} alt="" className="w-full h-full object-contain rounded-full"/>
                          : <ImageIcon size={20} className="text-muted-foreground"/>}
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="text-sm"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          const r = new FileReader();
                          r.onload = () => setForm(prev => ({ ...prev, logo: r.result }));
                          r.readAsDataURL(f);
                        }}
                        data-testid="chp-logo-upload"
                      />
                      {form.logo && (
                        <button type="button" onClick={() => setForm(prev => ({ ...prev, logo: "" }))} className="text-xs text-muted-foreground hover:text-[hsl(0,65%,55%)]">Remove</button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Displays like the HOMENETMEN HASK homepage logo — round with a white background.</p>
                  </div>
                  <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} data-testid="chp-name" /></div>
                  <div><Label>Name (Armenian)</Label><Input value={form.name_hy} onChange={e => setForm({...form, name_hy: e.target.value})} /></div>
                  <div><Label>Location</Label><Input value={form.location} onChange={e => setForm({...form, location: e.target.value})} /></div>
                  <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Email</Label><Input value={form.contact_email} onChange={e => setForm({...form, contact_email: e.target.value})} /></div>
                    <div><Label>Phone</Label><Input value={form.contact_phone} onChange={e => setForm({...form, contact_phone: e.target.value})} /></div>
                  </div>
                  <Button onClick={save} className="btn-pill w-full bg-[hsl(149,40%,30%)]" data-testid="chp-save">{editing ? "Save changes" : "Create"}</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {chapters.map(c => (
          <Card key={c.chapter_id} className={`clay-card p-6 hover-lift relative ${c.archived ? "opacity-60" : ""}`} data-testid={`chapter-card-${c.chapter_id}`}>
            {isAdmin && (
              <div className="absolute top-3 right-3 flex gap-1">
                <button
                  onClick={(e) => { e.preventDefault(); openEdit(c); }}
                  className="w-8 h-8 rounded-full text-muted-foreground hover:bg-[hsl(12,65%,63%)]/20 hover:text-[hsl(12,65%,63%)] flex items-center justify-center"
                  data-testid={`edit-chp-${c.chapter_id}`}
                  title="Edit chapter"
                ><Pencil size={14}/></button>
                <button
                  onClick={(e) => { e.preventDefault(); archive(c.chapter_id, c.archived); }}
                  className="w-8 h-8 rounded-full text-muted-foreground hover:bg-[hsl(32,87%,67%)]/20 hover:text-[hsl(32,87%,55%)] flex items-center justify-center"
                  data-testid={`archive-chp-${c.chapter_id}`}
                  title={c.archived ? "Unarchive" : "Archive"}
                >
                  {c.archived ? <ArchiveRestore size={14}/> : <Archive size={14}/>}
                </button>
              </div>
            )}
            <Link to={`/chapters/${c.chapter_id}`}>
              <div className="w-14 h-14 rounded-full bg-white shadow-inner border-2 border-border flex items-center justify-center overflow-hidden p-1">
                {c.logo
                  ? <img src={c.logo} alt="" className="w-full h-full object-contain rounded-full"/>
                  : <Building2 size={22} className="text-[hsl(149,40%,30%)]"/>}
              </div>
              <div className="mt-4 font-display text-xl font-bold">{c.name}</div>
              <div className="text-sm text-muted-foreground">{c.name_hy}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-3"><MapPin size={12} />{c.location}</div>
              <p className="text-sm mt-3 line-clamp-2">{c.description}</p>
              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-sm">
                <div className="flex items-center gap-2"><Users size={14} /> <span className="font-bold">{c.member_count}</span> members</div>
                <div className="text-[hsl(12,65%,63%)] font-bold text-xs uppercase tracking-widest">View →</div>
              </div>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
