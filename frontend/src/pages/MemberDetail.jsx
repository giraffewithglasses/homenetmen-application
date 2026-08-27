import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Mail, Phone, Calendar, User, Shield } from "lucide-react";
import BadgePatch from "@/components/BadgePatch";

export default function MemberDetail() {
  const { id } = useParams();
  const [m, setM] = useState(null);
  const [allBadges, setAllBadges] = useState([]);

  useEffect(() => {
    api.get(`/members/${id}`).then(r => setM(r.data));
    api.get("/badges").then(r => setAllBadges(r.data));
  }, [id]);

  if (!m) return <div>Loading…</div>;

  const badgeById = (bid) => allBadges.find(b => b.badge_id === bid);
  const attStats = m.attendance?.reduce((acc, a) => { acc[a.status] = (acc[a.status] || 0) + 1; return acc; }, {}) || {};

  return (
    <div className="space-y-6">
      <Link to="/members" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={14}/> All members</Link>

      <Card className="clay-card p-8">
        <div className="flex items-start gap-6">
          <div className="w-24 h-24 rounded-full bg-[hsl(12,65%,63%)]/20 text-[hsl(12,65%,63%)] flex items-center justify-center font-black text-4xl font-display">{m.full_name[0]}</div>
          <div>
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
        <h3 className="font-display font-bold mb-4">Badges</h3>
        <div className="flex flex-wrap gap-8">
          {(m.badges || []).map(mb => {
            const b = badgeById(mb.badge_id);
            if (!b) return null;
            const total = b.requirements?.length || 1;
            const done = (mb.completed_requirements || []).filter(Boolean).length;
            const pct = Math.round(done / total * 100);
            return (
              <div key={mb.mb_id} className="text-center">
                <BadgePatch badge={b} awarded={mb.awarded} progress={pct} />
                <div className="text-xs font-semibold mt-2 max-w-[80px]">{b.name}</div>
                {mb.awarded && <div className="text-[10px] uppercase tracking-widest text-[hsl(149,40%,30%)] font-bold">Awarded</div>}
              </div>
            );
          })}
          {!m.badges?.length && <div className="text-sm text-muted-foreground">No badges yet.</div>}
        </div>
      </Card>

      {m.notes && (
        <Card className="clay-card p-6">
          <h3 className="font-display font-bold mb-2">Notes</h3>
          <p className="text-sm text-muted-foreground">{m.notes}</p>
        </Card>
      )}
    </div>
  );
}
