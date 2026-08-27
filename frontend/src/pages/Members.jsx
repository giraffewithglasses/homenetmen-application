import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { confirmWithUndo } from "@/lib/undo";
import { Plus, Download, Search, Archive, Pencil } from "lucide-react";

const SECTIONS = ["Cubs", "Scouts", "Senior Scouts", "Rovers"];
const POSITIONS = ["Member", "Assistant Patrol Leader", "Patrol Leader", "Chapter Leader", "Chapter Admin"];

const emptyForm = {
  full_name: "", full_name_hy: "", email: "", phone: "", dob: "", gender: "",
  chapter_id: "", section: "Scouts", patrol: "",
  guardian_name: "", guardian_phone: "", emergency_contact: "",
  membership_start: "", position: "Member", notes: "", status: "active",
};

export default function Members() {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [q, setQ] = useState("");
  const [section, setSection] = useState("all");
  const [status, setStatus] = useState("all");
  const [chapter, setChapter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null); // member being edited
  const [form, setForm] = useState({ ...emptyForm, chapter_id: user?.chapter_id || "" });
  const [selected, setSelected] = useState(new Set());

  const load = async () => {
    const params = new URLSearchParams();
    if (chapter !== "all") params.append("chapter_id", chapter);
    if (section !== "all") params.append("section", section);
    if (status !== "all") params.append("status", status);
    if (q) params.append("q", q);
    const { data } = await api.get(`/members?${params}`);
    setMembers(data); setSelected(new Set());
  };
  useEffect(() => { load(); }, [q, section, status, chapter]);
  useEffect(() => { api.get("/chapters").then(r => setChapters(r.data)); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm, chapter_id: user?.chapter_id || "" });
    setOpen(true);
  };
  const openEdit = (m) => {
    setEditing(m);
    setForm({ ...emptyForm, ...m });
    setOpen(true);
  };
  const save = async () => {
    try {
      const payload = { ...form, chapter_id: form.chapter_id || user?.chapter_id };
      if (editing) await api.put(`/members/${editing.member_id}`, payload);
      else await api.post("/members", payload);
      toast.success(editing ? "Member updated" : "Member added");
      setOpen(false); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const archiveOne = (m) => {
    const prev = members;
    setMembers(members.filter(x => x.member_id !== m.member_id));
    confirmWithUndo({
      message: `Archived ${m.full_name}`,
      doDelete: async () => { await api.delete(`/members/${m.member_id}`); },
      restore: () => setMembers(prev),
    });
  };
  const archiveBulk = () => {
    if (!selected.size) return;
    const ids = Array.from(selected);
    const prev = members;
    const kept = members.filter(m => !selected.has(m.member_id));
    setMembers(kept); setSelected(new Set());
    confirmWithUndo({
      message: `Archived ${ids.length} members`,
      doDelete: async () => { for (const id of ids) await api.delete(`/members/${id}`); },
      restore: () => setMembers(prev),
    });
  };

  const toggleAll = (checked) => {
    if (checked) setSelected(new Set(members.map(m => m.member_id)));
    else setSelected(new Set());
  };
  const toggleOne = (id, checked) => {
    const n = new Set(selected);
    if (checked) n.add(id); else n.delete(id);
    setSelected(n);
  };

  const exportCSV = () => {
    const headers = ["full_name", "email", "phone", "section", "patrol", "chapter_id", "status", "position"];
    const rows = [headers.join(","), ...members.map(m => headers.map(h => JSON.stringify(m[h] ?? "")).join(","))];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "members.csv"; a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="uppercase-label">Database</div>
          <h1 className="font-display text-4xl lg:text-5xl font-black tracking-tight mt-1">Members</h1>
          <p className="text-muted-foreground mt-1 text-sm">{members.length} shown{selected.size ? ` · ${selected.size} selected` : ""}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {selected.size > 0 && (
            <Button variant="outline" className="btn-pill text-[hsl(0,65%,55%)] border-[hsl(0,65%,55%)]/40 hover:bg-[hsl(0,65%,55%)]/10" onClick={archiveBulk} data-testid="bulk-archive-members">
              <Archive size={16} className="mr-2"/> Archive selected ({selected.size})
            </Button>
          )}
          <Button variant="outline" className="btn-pill" onClick={exportCSV} data-testid="export-csv"><Download size={16} className="mr-2"/> CSV</Button>
          <Button className="btn-pill bg-[hsl(12,65%,63%)]" onClick={openNew} data-testid="new-member-btn"><Plus size={16} className="mr-2"/>New Member</Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Member" : "New Member"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Full name</Label><Input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} data-testid="mbr-name"/></div>
            <div><Label>Full name (Armenian)</Label><Input value={form.full_name_hy || ""} onChange={e => setForm({...form, full_name_hy: e.target.value})}/></div>
            <div><Label>Email</Label><Input value={form.email || ""} onChange={e => setForm({...form, email: e.target.value})}/></div>
            <div><Label>Phone</Label><Input value={form.phone || ""} onChange={e => setForm({...form, phone: e.target.value})}/></div>
            <div><Label>Date of birth</Label><Input type="date" value={form.dob || ""} onChange={e => setForm({...form, dob: e.target.value})}/></div>
            <div><Label>Gender</Label><Input value={form.gender || ""} onChange={e => setForm({...form, gender: e.target.value})}/></div>
            {user?.role === "national_admin" && (
              <div><Label>Chapter</Label>
                <Select value={form.chapter_id || ""} onValueChange={v => setForm({...form, chapter_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Choose"/></SelectTrigger>
                  <SelectContent>{chapters.map(c => <SelectItem key={c.chapter_id} value={c.chapter_id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Section</Label>
              <Select value={form.section} onValueChange={v => setForm({...form, section: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{SECTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Patrol</Label><Input value={form.patrol || ""} onChange={e => setForm({...form, patrol: e.target.value})}/></div>
            <div><Label>Leadership position</Label>
              <Select value={form.position || "Member"} onValueChange={v => setForm({...form, position: v})}>
                <SelectTrigger data-testid="mbr-position"><SelectValue/></SelectTrigger>
                <SelectContent>{POSITIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Status</Label>
              <Select value={form.status || "active"} onValueChange={v => setForm({...form, status: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Guardian name</Label><Input value={form.guardian_name || ""} onChange={e => setForm({...form, guardian_name: e.target.value})}/></div>
            <div><Label>Guardian phone</Label><Input value={form.guardian_phone || ""} onChange={e => setForm({...form, guardian_phone: e.target.value})}/></div>
            <div><Label>Emergency contact</Label><Input value={form.emergency_contact || ""} onChange={e => setForm({...form, emergency_contact: e.target.value})}/></div>
            <div><Label>Membership start</Label><Input type="date" value={form.membership_start || ""} onChange={e => setForm({...form, membership_start: e.target.value})}/></div>
          </div>
          <Button onClick={save} className="btn-pill w-full bg-[hsl(149,40%,30%)] mt-2" data-testid="mbr-save">
            {editing ? "Save changes" : "Add member"}
          </Button>
          {editing && form.position && ["Chapter Leader", "Chapter Admin"].includes(form.position) && (
            <p className="text-xs text-muted-foreground mt-2">
              Tip: to give this member sign-in permissions matching their new role, also update their user account in <Link to="/administration" className="text-[hsl(12,65%,63%)] font-semibold">Administration</Link>.
            </p>
          )}
        </DialogContent>
      </Dialog>

      <Card className="clay-card p-4">
        <div className="grid md:grid-cols-4 gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-3 text-muted-foreground" />
            <Input placeholder="Search name or email" value={q} onChange={e => setQ(e.target.value)} className="pl-9" data-testid="mbr-search"/>
          </div>
          {user?.role === "national_admin" && (
            <Select value={chapter} onValueChange={setChapter}>
              <SelectTrigger><SelectValue placeholder="Chapter"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All chapters</SelectItem>
                {chapters.map(c => <SelectItem key={c.chapter_id} value={c.chapter_id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={section} onValueChange={setSection}>
            <SelectTrigger><SelectValue placeholder="Section"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sections</SelectItem>
              {SECTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Status"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="clay-card p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={selected.size > 0 && selected.size === members.length}
                  onCheckedChange={toggleAll}
                  data-testid="mbr-check-all"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Section</TableHead>
              <TableHead>Patrol</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Chapter</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m, i) => (
              <TableRow key={m.member_id} className={i % 2 ? "bg-muted/30" : ""} data-testid={`member-row-${m.member_id}`}>
                <TableCell>
                  <Checkbox
                    checked={selected.has(m.member_id)}
                    onCheckedChange={(v) => toggleOne(m.member_id, v)}
                    data-testid={`mbr-check-${m.member_id}`}
                  />
                </TableCell>
                <TableCell>
                  <Link to={`/members/${m.member_id}`} className="flex items-center gap-3 hover:text-[hsl(12,65%,63%)]">
                    <div className="w-9 h-9 rounded-full bg-[hsl(12,65%,63%)]/20 text-[hsl(12,65%,63%)] flex items-center justify-center font-bold">{m.full_name[0]}</div>
                    <div>
                      <div className="font-semibold">{m.full_name}</div>
                      <div className="text-xs text-muted-foreground">{m.full_name_hy}</div>
                    </div>
                  </Link>
                </TableCell>
                <TableCell>{m.section}</TableCell>
                <TableCell>{m.patrol}</TableCell>
                <TableCell>
                  {["Chapter Leader", "Chapter Admin", "Patrol Leader"].includes(m.position)
                    ? <Badge className="rounded-full bg-[hsl(149,40%,30%)]">{m.position}</Badge>
                    : <span className="text-sm text-muted-foreground">{m.position}</span>}
                </TableCell>
                <TableCell><span className="text-xs">{chapters.find(c => c.chapter_id === m.chapter_id)?.name || m.chapter_id}</span></TableCell>
                <TableCell><Badge variant={m.status === "active" ? "default" : "secondary"} className="rounded-full">{m.status}</Badge></TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(m)} data-testid={`edit-mbr-${m.member_id}`}>
                    <Pencil size={14}/>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => archiveOne(m)} data-testid={`archive-mbr-${m.member_id}`}>
                    <Archive size={14} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
