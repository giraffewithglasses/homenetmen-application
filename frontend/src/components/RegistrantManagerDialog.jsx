import React, { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Download, CheckCircle2, XCircle, ArrowUpCircle, Trash2, Loader2 } from "lucide-react";

/**
 * Registrant Manager — full modal for admins/leaders to search, mark paid, remove,
 * promote from waitlist, and download the Excel of a program's registrants.
 *
 * Props:
 *   program: { program_id, title, fee, waitlist_count }
 *   open: bool
 *   onClose: fn
 *   onChanged: fn (called after any mutation so parent can refresh counts)
 */
export default function RegistrantManagerDialog({ program, open, onClose, onChanged }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all"); // all | registered | waitlisted | unpaid | paid
  const [busyId, setBusyId] = useState(null);
  const fee = Number(program?.fee || 0);
  const paidRelevant = fee > 0;

  const load = async () => {
    if (!program?.program_id) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/programs/${program.program_id}/registrations`);
      setRows(data || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to load registrants");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) { setQ(""); setFilter("all"); load(); } /* eslint-disable-next-line */ }, [open, program?.program_id]);

  const notifyChanged = () => {
    try { window.dispatchEvent(new CustomEvent("program-registrations-changed")); } catch (err) { /* noop */ }
    onChanged?.();
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter(r => {
      const m = r.member || {};
      const bag = `${m.full_name || ""} ${m.full_name_hy || ""} ${m.email || ""} ${m.phone || ""} ${m.patrol || ""} ${m.section || ""}`.toLowerCase();
      if (term && !bag.includes(term)) return false;
      if (filter === "registered" && r.status !== "registered") return false;
      if (filter === "waitlisted" && r.status !== "waitlisted") return false;
      if (filter === "unpaid" && !(paidRelevant && r.status === "registered" && !r.paid)) return false;
      if (filter === "paid" && !(paidRelevant && r.paid)) return false;
      return true;
    });
  }, [rows, q, filter, paidRelevant]);

  const counts = useMemo(() => ({
    all: rows.length,
    registered: rows.filter(r => r.status === "registered").length,
    waitlisted: rows.filter(r => r.status === "waitlisted").length,
    unpaid: rows.filter(r => paidRelevant && r.status === "registered" && !r.paid).length,
    paid: rows.filter(r => paidRelevant && r.paid).length,
  }), [rows, paidRelevant]);

  const mutate = async (reg_id, verb, opts = {}) => {
    setBusyId(reg_id);
    try {
      if (verb === "delete") {
        await api.delete(`/programs/registrations/${reg_id}`);
      } else {
        await api.post(`/programs/registrations/${reg_id}/${verb}`);
      }
      toast.success(opts.msg || "Updated");
      await load();
      notifyChanged();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setBusyId(null);
    }
  };

  const removeReg = (r) => {
    if (!window.confirm(`Remove ${r.member?.full_name || "this registrant"} from '${program.title}'? ${r.status === "registered" ? "The next waitlisted scout will be promoted." : ""}`)) return;
    mutate(r.reg_id, "delete", { msg: "Registrant removed" });
  };

  const download = async () => {
    if (!rows.length) { toast("No registrants yet for this program"); return; }
    const XLSX = await import("xlsx");
    const headers = [
      "full_name", "full_name_hy", "email", "phone", "dob", "gender",
      "section", "patrol", "position", "chapter_name",
      "guardian_name", "guardian_phone", "parent_email", "emergency_contact",
      "membership_start", "registration_status", "paid", "registered_at",
    ];
    const source = filtered.length ? filtered : rows;
    const data = source.map(r => ({
      full_name: r.member?.full_name || "",
      full_name_hy: r.member?.full_name_hy || "",
      email: r.member?.email || "",
      phone: r.member?.phone || "",
      dob: r.member?.dob || "",
      gender: r.member?.gender || "",
      section: r.member?.section || "",
      patrol: r.member?.patrol || "",
      position: r.member?.position || "",
      chapter_name: r.member?.chapter_name || "",
      guardian_name: r.member?.guardian_name || "",
      guardian_phone: r.member?.guardian_phone || "",
      parent_email: r.member?.parent_email || "",
      emergency_contact: r.member?.emergency_contact || "",
      membership_start: r.member?.membership_start || "",
      registration_status: r.status || "",
      paid: r.paid ? "Yes" : (paidRelevant ? "No" : "Free"),
      registered_at: r.created_at ? r.created_at.slice(0, 19).replace("T", " ") : "",
    }));
    const ws = XLSX.utils.json_to_sheet(data, { header: headers });
    ws["!cols"] = headers.map(h => ({ wch: Math.max(16, h.length + 2) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Registrants");
    const date = new Date().toISOString().slice(0, 10);
    const safeTitle = (program.title || "program").replace(/[^a-z0-9-]+/gi, "_").slice(0, 40);
    XLSX.writeFile(wb, `registrants-${safeTitle}-${date}.xlsx`);
    toast.success(`Downloaded ${data.length} row${data.length === 1 ? "" : "s"}`);
  };

  const FILTERS = paidRelevant
    ? [["all", "All"], ["registered", "Registered"], ["waitlisted", "Waitlist"], ["unpaid", "Unpaid"], ["paid", "Paid"]]
    : [["all", "All"], ["registered", "Registered"], ["waitlisted", "Waitlist"]];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col p-0" data-testid="registrant-manager-dialog">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span data-testid="registrant-manager-title">Registrants · {program?.title}</span>
            <Badge variant="outline" className="rounded-full">{counts.registered} registered</Badge>
            {counts.waitlisted > 0 && <Badge className="rounded-full bg-[hsl(32,87%,55%)] text-[hsl(155,60%,8%)]">{counts.waitlisted} on waitlist</Badge>}
            {paidRelevant && counts.unpaid > 0 && <Badge className="rounded-full bg-[hsl(0,65%,55%)]">{counts.unpaid} unpaid</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-3 flex flex-wrap gap-3 items-center border-b border-border">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-2.5 text-muted-foreground"/>
            <Input placeholder="Search name, email, phone, patrol…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" data-testid="registrant-search"/>
          </div>
          <div className="flex flex-wrap gap-1">
            {FILTERS.map(([k, label]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${filter === k ? "bg-[hsl(149,40%,30%)] text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
                data-testid={`registrant-filter-${k}`}
              >{label} · {counts[k]}</button>
            ))}
          </div>
          <Button size="sm" onClick={download} className="btn-pill bg-[hsl(149,40%,30%)]" data-testid="registrant-download">
            <Download size={12} className="mr-1"/> Excel
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2"><Loader2 className="animate-spin" size={16}/> Loading registrants…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {rows.length === 0 ? "No registrations yet." : "No registrants match this search."}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(r => {
                const m = r.member || {};
                const isWaitlisted = r.status === "waitlisted";
                const isRegistered = r.status === "registered";
                const isUnpaid = paidRelevant && isRegistered && !r.paid;
                const isBusy = busyId === r.reg_id;
                return (
                  <div key={r.reg_id} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/30 transition-colors" data-testid={`registrant-row-${r.reg_id}`}>
                    <div className="w-9 h-9 rounded-full bg-[hsl(12,65%,63%)]/20 text-[hsl(12,65%,63%)] flex items-center justify-center font-bold flex-shrink-0">
                      {(m.full_name || "?")[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm truncate">{m.full_name || "Unknown"}</span>
                        {m.section && <Badge variant="outline" className="rounded-full text-[10px]">{m.section}</Badge>}
                        {m.patrol && <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{m.patrol}</span>}
                        {isWaitlisted && <Badge className="rounded-full bg-[hsl(32,87%,55%)] text-[hsl(155,60%,8%)] text-[10px]">Waitlisted</Badge>}
                        {isRegistered && !paidRelevant && <Badge className="rounded-full bg-[hsl(149,40%,30%)] text-[10px]">Registered</Badge>}
                        {paidRelevant && r.paid && <Badge className="rounded-full bg-[hsl(149,40%,30%)] text-[10px]">Paid</Badge>}
                        {isUnpaid && <Badge className="rounded-full bg-[hsl(0,65%,55%)] text-[10px]">Unpaid</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {m.email || "—"}{m.phone ? ` · ${m.phone}` : ""}{m.chapter_name ? ` · ${m.chapter_name}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isWaitlisted && (
                        <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => mutate(r.reg_id, "promote", { msg: "Promoted from waitlist" })} className="btn-pill text-[hsl(149,40%,30%)] hover:bg-[hsl(149,40%,30%)]/10" data-testid={`registrant-promote-${r.reg_id}`}>
                          <ArrowUpCircle size={12} className="mr-1"/> Promote
                        </Button>
                      )}
                      {paidRelevant && isRegistered && !r.paid && (
                        <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => mutate(r.reg_id, "mark-paid", { msg: "Marked as paid" })} className="btn-pill text-[hsl(149,40%,30%)] hover:bg-[hsl(149,40%,30%)]/10" data-testid={`registrant-mark-paid-${r.reg_id}`}>
                          <CheckCircle2 size={12} className="mr-1"/> Mark paid
                        </Button>
                      )}
                      {paidRelevant && r.paid && (
                        <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => mutate(r.reg_id, "mark-unpaid", { msg: "Marked as unpaid" })} className="btn-pill text-muted-foreground hover:bg-muted" data-testid={`registrant-mark-unpaid-${r.reg_id}`} title="Undo paid status">
                          <XCircle size={12} className="mr-1"/> Unpaid
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => removeReg(r)} className="btn-pill text-[hsl(0,65%,55%)] hover:bg-[hsl(0,65%,55%)]/10" data-testid={`registrant-remove-${r.reg_id}`}>
                        <Trash2 size={12} className="mr-1"/> Remove
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
