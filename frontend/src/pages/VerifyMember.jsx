import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { CheckCircle2, XCircle, ShieldCheck, MapPin, Loader2 } from "lucide-react";

export default function VerifyMember() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/public/members/${id}/verify`).then(r => setData(r.data)).catch(() => setData({ valid: false, reason: "error" })).finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[hsl(42,30%,94%)]">
      <Card className="clay-card p-8 max-w-md w-full" data-testid="verify-card">
        <Link to="/" className="flex items-center gap-2 justify-center mb-6">
          <div className="w-10 h-10 rounded-full bg-white shadow-inner border-2 border-border p-1 flex items-center justify-center">
            <img src="/brand/homenetmen-logo.webp" alt="" className="w-full h-full object-contain"/>
          </div>
          <div className="text-center">
            <div className="font-display font-black text-sm">HOMENETMEN HASK</div>
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Membership verification</div>
          </div>
        </Link>

        {loading && (
          <div className="text-center py-8">
            <Loader2 size={40} className="animate-spin mx-auto text-[hsl(12,65%,63%)]"/>
            <div className="text-sm text-muted-foreground mt-3">Checking membership…</div>
          </div>
        )}

        {!loading && data && data.valid && (
          <div className="text-center">
            <CheckCircle2 size={56} className="mx-auto text-[hsl(149,40%,30%)]"/>
            <div className="uppercase-label mt-3 text-[hsl(149,40%,30%)]">Active member</div>
            <h1 className="font-display font-black text-2xl mt-1" data-testid="verify-name">{data.member.full_name}</h1>
            {data.member.full_name_hy && <div className="text-sm text-muted-foreground">{data.member.full_name_hy}</div>}

            <div className="mt-6 grid grid-cols-2 gap-3 text-left text-sm">
              <div className="p-3 rounded-xl bg-muted">
                <div className="uppercase-label">Section</div>
                <div className="font-semibold">{data.member.section}</div>
              </div>
              <div className="p-3 rounded-xl bg-muted">
                <div className="uppercase-label">Patrol</div>
                <div className="font-semibold">{data.member.patrol || "—"}</div>
              </div>
              {data.chapter && (
                <div className="col-span-2 p-3 rounded-xl bg-muted">
                  <div className="uppercase-label">Chapter</div>
                  <div className="font-semibold flex items-center gap-1"><MapPin size={12}/> {data.chapter.name}</div>
                  {data.chapter.location && <div className="text-xs text-muted-foreground">{data.chapter.location}</div>}
                </div>
              )}
              {data.member.position && data.member.position !== "Member" && (
                <div className="col-span-2 p-3 rounded-xl bg-[hsl(12,65%,63%)]/10 border border-[hsl(12,65%,63%)]/30">
                  <div className="uppercase-label text-[hsl(12,65%,55%)]">Position</div>
                  <div className="font-semibold">{data.member.position}</div>
                </div>
              )}
              {data.member.membership_start && (
                <div className="col-span-2 p-3 rounded-xl bg-muted">
                  <div className="uppercase-label">Member since</div>
                  <div className="font-semibold">{data.member.membership_start}</div>
                </div>
              )}
            </div>

            <div className="mt-6 inline-flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck size={12}/> Verified by HOMENETMEN HASK
            </div>
          </div>
        )}

        {!loading && data && !data.valid && (
          <div className="text-center py-4" data-testid="verify-invalid">
            <XCircle size={56} className="mx-auto text-[hsl(0,65%,55%)]"/>
            <h1 className="font-display font-black text-2xl mt-3">Not a current member</h1>
            <p className="text-sm text-muted-foreground mt-2">
              {data.reason === "not_found"
                ? "We couldn't find this membership ID."
                : "This scout's membership isn't currently active."}
            </p>
            <Link to="/" className="text-sm text-[hsl(12,65%,55%)] font-bold mt-4 inline-block">Return home →</Link>
          </div>
        )}
      </Card>
    </div>
  );
}
