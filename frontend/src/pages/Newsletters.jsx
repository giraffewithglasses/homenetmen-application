import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Plus, Mail, Trash2 } from "lucide-react";

export default function Newsletters() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ title: "", title_hy: "", short_description: "", content: "", author: user?.name || "", cover: "" });

  const load = () => api.get("/newsletters").then(r => setItems(r.data));
  useEffect(() => { load(); }, []);

  const save = async () => {
    try { await api.post("/newsletters", form); toast.success("Published"); setOpen(false); load(); }
    catch { toast.error("Failed"); }
  };
  const remove = async (nid) => {
    if (!window.confirm("Delete this newsletter?")) return;
    try { await api.delete(`/newsletters/${nid}`); toast.success("Deleted"); load(); }
    catch { toast.error("Failed"); }
  };
  const isAdmin = user?.role === "national_admin";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="uppercase-label">Publications</div>
          <h1 className="font-display text-4xl lg:text-5xl font-black tracking-tight mt-1">Newsletters</h1>
        </div>
        {user?.role === "national_admin" && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="btn-pill bg-[hsl(12,65%,63%)]" data-testid="new-newsletter-btn"><Plus size={16} className="mr-2"/>Publish</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>New Newsletter</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})}/></div>
                <div><Label>Title (Armenian)</Label><Input value={form.title_hy} onChange={e => setForm({...form, title_hy: e.target.value})}/></div>
                <div><Label>Short description</Label><Input value={form.short_description} onChange={e => setForm({...form, short_description: e.target.value})}/></div>
                <div><Label>Content</Label><Textarea rows={6} value={form.content} onChange={e => setForm({...form, content: e.target.value})}/></div>
                <div>
                  <Label>Cover image</Label>
                  <input
                    type="file"
                    accept="image/*"
                    className="block w-full text-sm mt-1"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const r = new FileReader();
                      r.onload = () => setForm(prev => ({ ...prev, cover: r.result }));
                      r.readAsDataURL(f);
                    }}
                    data-testid="newsletter-cover-upload"
                  />
                  {form.cover && <img src={form.cover} alt="" className="mt-2 h-24 rounded-lg object-cover"/>}
                </div>
                <div><Label>Author</Label><Input value={form.author} onChange={e => setForm({...form, author: e.target.value})}/></div>
                <Button onClick={save} className="btn-pill w-full bg-[hsl(149,40%,30%)]">Publish</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {items[0] && (
        <Card className="clay-card overflow-hidden relative">
          {isAdmin && (
            <button
              onClick={() => remove(items[0].newsletter_id)}
              className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/90 hover:bg-[hsl(0,65%,55%)] hover:text-white text-muted-foreground flex items-center justify-center"
              data-testid={`del-newsletter-${items[0].newsletter_id}`}
            ><Trash2 size={14}/></button>
          )}
          <div className="grid md:grid-cols-2">
            <div className="h-56 md:h-auto" style={{
              backgroundImage: `url('${items[0].cover || 'https://images.unsplash.com/photo-1597120590849-a1d5a743d155?crop=entropy&cs=srgb&fm=jpg&q=85'}')`,
              backgroundSize: "cover", backgroundPosition: "center",
            }}/>
            <div className="p-8">
              <div className="uppercase-label">Latest issue · {new Date(items[0].created_at).toLocaleDateString()}</div>
              <h2 className="font-display text-3xl lg:text-4xl font-black mt-2">{items[0].title}</h2>
              <div className="text-muted-foreground">{items[0].title_hy}</div>
              <p className="mt-4 text-sm">{items[0].short_description}</p>
              <p className="mt-4 text-sm text-muted-foreground">{items[0].content}</p>
              <div className="mt-6 uppercase-label">By {items[0].author}</div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.slice(1).map(n => (
          <Card key={n.newsletter_id} className="clay-card overflow-hidden hover-lift relative">
            {isAdmin && (
              <button
                onClick={() => remove(n.newsletter_id)}
                className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/90 text-muted-foreground hover:bg-[hsl(0,65%,55%)] hover:text-white flex items-center justify-center"
                data-testid={`del-newsletter-${n.newsletter_id}`}
              ><Trash2 size={14}/></button>
            )}
            {n.cover && <div className="h-40 bg-muted" style={{ backgroundImage: `url('${n.cover}')`, backgroundSize: "cover", backgroundPosition: "center" }}/>}
            <div className="p-6">
              {!n.cover && <div className="w-10 h-10 rounded-full bg-[hsl(32,87%,67%)]/25 text-[hsl(32,87%,55%)] flex items-center justify-center"><Mail size={18}/></div>}
              <div className="uppercase-label mt-3">{new Date(n.created_at).toLocaleDateString()}</div>
              <div className="font-display font-bold text-lg mt-1">{n.title}</div>
              <div className="text-xs text-muted-foreground">{n.title_hy}</div>
              <p className="text-sm mt-3 line-clamp-3">{n.short_description}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
