import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, IdCard, MapPin, Calendar, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function MembershipCard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [m, setM] = useState(null);
  const [chapter, setChapter] = useState(null);

  useEffect(() => {
    api.get(`/members/${id}`).then(r => {
      setM(r.data);
      if (r.data?.chapter_id) {
        api.get(`/chapters/${r.data.chapter_id}`).then(c => setChapter(c.data)).catch(() => {});
      }
    }).catch(() => {});
  }, [id]);

  const verifyUrl = useMemo(() => {
    if (!m) return "";
    return `${window.location.origin}/verify/${m.member_id}`;
  }, [m]);

  const memberSince = useMemo(() => {
    if (!m?.membership_start) return "—";
    try {
      return new Date(m.membership_start).toLocaleDateString(undefined, { year: "numeric", month: "short" });
    } catch { return m.membership_start; }
  }, [m]);

  if (!m) return <div className="p-6">Loading…</div>;

  return (
    <div className="space-y-6 print:space-y-0">
      <div className="flex items-center justify-between print:hidden">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14}/> Back
        </button>
        <Button onClick={() => window.print()} className="btn-pill bg-[hsl(149,40%,30%)] hover:bg-[hsl(149,40%,25%)]" data-testid="card-print-btn">
          <Printer size={14} className="mr-2"/> Print card
        </Button>
      </div>

      <div className="flex justify-center">
        <div
          className="relative w-full max-w-[640px] aspect-[1.586/1] rounded-[36px] overflow-hidden text-white shadow-2xl print:shadow-none print:rounded-none"
          style={{
            background: "linear-gradient(135deg, hsl(152 43% 15%) 0%, hsl(149 40% 30%) 55%, hsl(12 65% 55%) 100%)",
          }}
          data-testid="membership-card"
        >
          {/* Decorative rings */}
          <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full border-2 border-white/10"/>
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full border-2 border-white/10"/>
          <div className="absolute -bottom-32 -left-24 w-64 h-64 rounded-full border-2 border-white/5"/>

          {/* Header */}
          <div className="relative px-8 pt-7 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-white/95 p-1.5 flex items-center justify-center">
                <img src="/brand/homenetmen-logo.webp" alt="" className="w-full h-full object-contain"/>
              </div>
              <div>
                <div className="font-display font-black leading-none text-lg">HOMENETMEN HASK</div>
                <div className="text-[10px] tracking-[0.3em] uppercase opacity-70 mt-1">Est. 1989 · Official Scout ID</div>
              </div>
            </div>
            <IdCard size={28} className="opacity-80"/>
          </div>

          {/* Body */}
          <div className="relative px-8 pt-5 pb-6 flex items-end justify-between gap-6 h-[calc(100%-88px)]">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.32em] opacity-70">Member</div>
              <div className="font-display font-black text-3xl leading-tight truncate mt-1" data-testid="card-name">{m.full_name}</div>
              {m.full_name_hy && <div className="text-sm opacity-80 truncate mt-0.5">{m.full_name_hy}</div>}

              <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
                <div>
                  <div className="uppercase tracking-[0.22em] opacity-60 text-[9px]">Section</div>
                  <div className="font-semibold text-sm mt-0.5">{m.section}</div>
                </div>
                <div>
                  <div className="uppercase tracking-[0.22em] opacity-60 text-[9px]">Patrol</div>
                  <div className="font-semibold text-sm mt-0.5">{m.patrol || "—"}</div>
                </div>
                <div className="col-span-2">
                  <div className="uppercase tracking-[0.22em] opacity-60 text-[9px]">Chapter</div>
                  <div className="font-semibold text-sm mt-0.5 flex items-center gap-1"><MapPin size={12}/> {chapter?.name || m.chapter_id || "—"}</div>
                </div>
                <div className="col-span-2">
                  <div className="uppercase tracking-[0.22em] opacity-60 text-[9px]">Member since</div>
                  <div className="font-semibold text-sm mt-0.5 flex items-center gap-1"><Calendar size={12}/> {memberSince}</div>
                </div>
              </div>
            </div>

            <div className="flex-shrink-0 flex flex-col items-center gap-2">
              <div className="p-2.5 bg-white rounded-2xl shadow-lg" data-testid="card-qr">
                <QRCodeSVG value={verifyUrl} size={120} bgColor="#ffffff" fgColor="#0d3320" level="M"/>
              </div>
              <div className="text-[9px] tracking-[0.24em] opacity-80 uppercase flex items-center gap-1 font-semibold">
                <ShieldCheck size={10}/> Scan to verify
              </div>
            </div>
          </div>

          {/* Footer strip */}
          <div className="absolute bottom-0 inset-x-0 h-8 bg-black/25 flex items-center justify-between px-6 text-[10px] tracking-[0.24em] uppercase">
            <span className="opacity-80 font-semibold">ID · {m.member_id.replace(/^mbr_/, "").toUpperCase()}</span>
            <span className={`px-3 py-0.5 rounded-full font-bold ${m.status === "active" ? "bg-[hsl(149,60%,45%)]" : "bg-[hsl(0,60%,50%)]"}`}>{m.status}</span>
          </div>
        </div>
      </div>

      <Card className="clay-card p-6 max-w-xl mx-auto print:hidden">
        <div className="flex items-center gap-3">
          <ShieldCheck className="text-[hsl(149,40%,30%)]" size={22}/>
          <div>
            <div className="font-semibold">Scannable verification</div>
            <div className="text-sm text-muted-foreground">The QR on this card links to <code className="text-xs">{verifyUrl}</code>. Anyone at camp can scan it to confirm the scout is a current member.</div>
          </div>
        </div>
      </Card>

      <style>{`
        @media print {
          @page { size: 5.4in 3.4in; margin: 0; }
          body * { visibility: hidden; }
          [data-testid="membership-card"], [data-testid="membership-card"] * { visibility: visible; }
          [data-testid="membership-card"] { position: fixed; left: 0; top: 0; width: 5.4in; height: 3.4in; }
        }
      `}</style>
    </div>
  );
}
