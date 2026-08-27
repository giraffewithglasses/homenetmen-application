import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";

const STATUSES = ["present", "absent", "late", "excused"];
const STATUS_STYLE = {
  present: { bg: "hsl(149 40% 30%)", icon: CheckCircle },
  absent: { bg: "hsl(0 65% 55%)", icon: XCircle },
  late: { bg: "hsl(32 87% 67%)", icon: Clock },
  excused: { bg: "hsl(156 15% 40%)", icon: AlertCircle },
};

export default function Attendance() {
  const { user } = useAuth();
  const [programs, setPrograms] = useState([]);
  const [selectedProgram, setSelectedProgram] = useState("");
  const [members, setMembers] = useState([]);
  const [existing, setExisting] = useState({});
  const [selections, setSelections] = useState({});

  useEffect(() => { api.get("/programs").then(r => setPrograms(r.data)); }, []);

  useEffect(() => {
    if (!selectedProgram) return;
    api.get("/members").then(r => setMembers(r.data));
    api.get(`/attendance?program_id=${selectedProgram}`).then(r => {
      const m = {}; r.data.forEach(a => m[a.member_id] = a.status);
      setExisting(m); setSelections(m);
    });
  }, [selectedProgram]);

  const setStatus = (mid, s) => setSelections({ ...selections, [mid]: s });

  const save = async () => {
    const entries = Object.entries(selections).map(([member_id, status]) => ({ member_id, status }));
    if (!entries.length) return;
    try {
      await api.post("/attendance", { program_id: selectedProgram, entries });
      toast.success("Attendance saved");
    } catch { toast.error("Failed"); }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="uppercase-label">Roll Call</div>
        <h1 className="font-display text-4xl lg:text-5xl font-black tracking-tight mt-1">Attendance</h1>
      </div>

      <Card className="clay-card p-6">
        <div className="flex items-center gap-3">
          <Select value={selectedProgram} onValueChange={setSelectedProgram}>
            <SelectTrigger className="max-w-md" data-testid="att-program-select"><SelectValue placeholder="Select a program"/></SelectTrigger>
            <SelectContent>
              {programs.map(p => <SelectItem key={p.program_id} value={p.program_id}>{p.title} — {p.date}</SelectItem>)}
            </SelectContent>
          </Select>
          {selectedProgram && <Button className="btn-pill bg-[hsl(149,40%,30%)]" onClick={save} data-testid="att-save">Save Attendance</Button>}
        </div>
      </Card>

      {selectedProgram && (
        <Card className="clay-card p-6">
          <div className="space-y-2">
            {members.map(m => (
              <div key={m.member_id} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[hsl(12,65%,63%)]/20 text-[hsl(12,65%,63%)] flex items-center justify-center font-bold">{m.full_name[0]}</div>
                  <div>
                    <div className="font-semibold text-sm">{m.full_name}</div>
                    <div className="text-xs text-muted-foreground">{m.section} · {m.patrol}</div>
                  </div>
                </div>
                <div className="flex gap-1">
                  {STATUSES.map(s => {
                    const S = STATUS_STYLE[s];
                    const active = selections[m.member_id] === s;
                    return (
                      <button
                        key={s}
                        onClick={() => setStatus(m.member_id, s)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${active ? "text-white" : "bg-muted hover:bg-muted/80 text-muted-foreground"}`}
                        style={active ? { background: S.bg } : {}}
                        data-testid={`att-${m.member_id}-${s}`}
                      >{s}</button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
