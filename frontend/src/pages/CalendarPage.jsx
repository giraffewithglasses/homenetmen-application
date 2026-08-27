import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function CalendarPage() {
  const [programs, setPrograms] = useState([]);
  const [cursor, setCursor] = useState(() => {
    const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() };
  });

  useEffect(() => { api.get("/programs").then(r => setPrograms(r.data)); }, []);

  const { y, m } = cursor;
  const first = new Date(y, m, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells = useMemo(() => {
    const arr = [];
    for (let i = 0; i < startDay; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    while (arr.length % 7) arr.push(null);
    return arr;
  }, [startDay, daysInMonth]);

  const eventsByDay = useMemo(() => {
    const map = {};
    programs.forEach(p => {
      const d = new Date(p.date);
      if (d.getFullYear() === y && d.getMonth() === m) {
        const day = d.getDate();
        map[day] = map[day] || []; map[day].push(p);
      }
    });
    return map;
  }, [programs, y, m]);

  const move = (delta) => {
    let nm = m + delta, ny = y;
    if (nm < 0) { nm = 11; ny--; }
    if (nm > 11) { nm = 0; ny++; }
    setCursor({ y: ny, m: nm });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="uppercase-label">Schedule</div>
          <h1 className="font-display text-4xl lg:text-5xl font-black tracking-tight mt-1">Calendar</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => move(-1)} className="w-10 h-10 rounded-full bg-white border border-border flex items-center justify-center hover:bg-muted" data-testid="cal-prev"><ChevronLeft size={18}/></button>
          <div className="font-display font-bold text-xl min-w-[180px] text-center">{MONTHS_EN[m]} {y}</div>
          <button onClick={() => move(1)} className="w-10 h-10 rounded-full bg-white border border-border flex items-center justify-center hover:bg-muted" data-testid="cal-next"><ChevronRight size={18}/></button>
        </div>
      </div>

      <Card className="clay-card p-4 lg:p-6">
        <div className="grid grid-cols-7 gap-2 text-xs uppercase tracking-widest text-muted-foreground font-bold mb-3 text-center">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {cells.map((d, i) => (
            <div key={i} className={`min-h-[100px] rounded-xl p-2 ${d ? "bg-muted/40 border border-border" : ""}`}>
              {d && (
                <>
                  <div className="text-xs font-bold text-muted-foreground">{d}</div>
                  <div className="mt-1 space-y-1">
                    {(eventsByDay[d] || []).slice(0,3).map(p => (
                      <Link key={p.program_id} to={`/programs/${p.program_id}`} className="block text-[10px] px-2 py-1 rounded-full bg-[hsl(12,65%,63%)] text-white truncate hover:bg-[hsl(12,70%,55%)]">
                        {p.title}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
