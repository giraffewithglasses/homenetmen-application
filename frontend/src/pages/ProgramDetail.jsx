import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CalendarDays, Clock, MapPin, Users, Package, Target } from "lucide-react";

export default function ProgramDetail() {
  const { id } = useParams();
  const [p, setP] = useState(null);

  useEffect(() => { api.get(`/programs/${id}`).then(r => setP(r.data)); }, [id]);

  if (!p) return <div>Loading…</div>;

  return (
    <div className="space-y-6">
      <Link to="/programs" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={14}/> All programs</Link>

      <Card className="clay-card overflow-hidden">
        <div className="h-56 relative" style={{
          backgroundImage: "linear-gradient(135deg, hsl(149 40% 30% / 0.85), hsl(12 65% 63% / 0.55)), url('https://images.unsplash.com/photo-1600706843784-6f0ad251f52f?crop=entropy&cs=srgb&fm=jpg&q=85')",
          backgroundSize: "cover", backgroundPosition: "center",
        }}>
          <div className="absolute inset-0 flex items-end p-8 text-white">
            <div>
              <Badge className="rounded-full bg-white/95 text-foreground mb-3">{p.section}</Badge>
              <h1 className="font-display text-4xl lg:text-5xl font-black">{p.title}</h1>
              <div className="text-white/85 mt-1">{p.title_hy}</div>
            </div>
          </div>
        </div>
        <div className="p-8 grid md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm leading-relaxed">{p.description}</p>
            <div className="mt-6 space-y-2 text-sm">
              <div className="flex items-center gap-2"><CalendarDays size={16}/> {p.date}</div>
              <div className="flex items-center gap-2"><Clock size={16}/> {p.start_time} – {p.end_time}</div>
              <div className="flex items-center gap-2"><MapPin size={16}/> {p.location}</div>
              <div className="flex items-center gap-2"><Users size={16}/> {p.expected_participants} expected</div>
              <div className="flex items-start gap-2"><Package size={16} className="mt-0.5"/> {p.materials}</div>
              <div className="flex items-start gap-2"><Target size={16} className="mt-0.5"/> {p.objectives}</div>
            </div>
            {p.prerequisites && (
              <div className="mt-6 rounded-2xl bg-[hsl(32,87%,67%)]/15 border-l-4 border-[hsl(32,87%,55%)] p-4">
                <div className="uppercase-label text-[hsl(32,87%,45%)]">Prerequisites</div>
                <p className="text-sm mt-1 whitespace-pre-line">{p.prerequisites}</p>
              </div>
            )}
            {Number(p.fee) > 0 && (
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(12,65%,63%)]/15 border border-[hsl(12,65%,63%)]/40 font-bold text-[hsl(12,65%,45%)]">
                ֏{Number(p.fee).toLocaleString()} AMD
              </div>
            )}
          </div>
          <div>
            <h3 className="font-display font-bold text-xl mb-4">Schedule</h3>
            <div className="relative border-l-2 border-[hsl(12,65%,63%)]/40 pl-6 space-y-4">
              {(p.activities || []).map((a, i) => (
                <div key={i} className="relative">
                  <div className="absolute -left-[31px] w-4 h-4 rounded-full bg-[hsl(12,65%,63%)] border-4 border-background"></div>
                  <div className="uppercase-label">{a.time}</div>
                  <div className="font-semibold">{a.title}</div>
                  <div className="text-xs text-muted-foreground">{a.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
