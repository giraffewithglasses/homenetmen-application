import React, { useEffect, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, XCircle, ArrowRight } from "lucide-react";

const MAX_POLLS = 12;
const POLL_MS = 2000;

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = params.get("session_id");
  const [state, setState] = useState({ status: "polling", record: null, tries: 0 });

  useEffect(() => {
    if (!sessionId) { setState({ status: "error", record: null, tries: 0 }); return; }
    let cancelled = false;
    let attempt = 0;

    const poll = async () => {
      if (cancelled) return;
      attempt += 1;
      try {
        const { data } = await api.get(`/payments/status/${sessionId}`);
        if (data.payment_status === "paid") {
          setState({ status: "paid", record: data, tries: attempt });
          return;
        }
        if (["expired", "failed"].includes(data.payment_status)) {
          setState({ status: "failed", record: data, tries: attempt });
          return;
        }
        if (attempt >= MAX_POLLS) {
          setState({ status: "timeout", record: data, tries: attempt });
          return;
        }
        setState({ status: "polling", record: data, tries: attempt });
        setTimeout(poll, POLL_MS);
      } catch (e) {
        // 404 → transaction genuinely doesn't exist; stop polling immediately
        if (e.response?.status === 404) {
          setState({ status: "notfound", record: null, tries: attempt });
          return;
        }
        if (attempt >= MAX_POLLS) {
          setState({ status: "error", record: null, tries: attempt });
        } else {
          setTimeout(poll, POLL_MS);
        }
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [sessionId]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[hsl(42,30%,94%)]">
      <Card className="clay-card p-10 max-w-md w-full text-center" data-testid="payment-status-card">
        {state.status === "polling" && (
          <>
            <Loader2 size={48} className="mx-auto animate-spin text-[hsl(12,65%,63%)]"/>
            <h1 className="font-display font-black text-2xl mt-4">Confirming your payment…</h1>
            <p className="text-sm text-muted-foreground mt-2">Hang tight — this usually takes a few seconds.</p>
          </>
        )}
        {state.status === "paid" && (
          <>
            <CheckCircle2 size={56} className="mx-auto text-[hsl(149,40%,30%)]"/>
            <h1 className="font-display font-black text-3xl mt-4" data-testid="payment-success-title">Payment confirmed</h1>
            <p className="text-sm text-muted-foreground mt-2">
              You paid {state.record?.currency?.toUpperCase() || "USD"} ${Number(state.record?.amount || 0).toFixed(2)}. Your registration is saved.
            </p>
            <Button
              onClick={() => navigate(state.record?.program_id ? `/programs/${state.record.program_id}` : "/programs")}
              className="btn-pill mt-6 bg-[hsl(12,65%,63%)] hover:bg-[hsl(12,70%,55%)]"
              data-testid="payment-back-btn"
            >View program <ArrowRight size={14} className="ml-2"/></Button>
          </>
        )}
        {state.status === "failed" && (
          <>
            <XCircle size={56} className="mx-auto text-[hsl(0,65%,55%)]"/>
            <h1 className="font-display font-black text-2xl mt-4">Payment didn't go through</h1>
            <p className="text-sm text-muted-foreground mt-2">Your registration wasn't charged. You can try again from the program page.</p>
            <Link to="/programs"><Button className="btn-pill mt-6">Back to programs</Button></Link>
          </>
        )}
        {state.status === "notfound" && (
          <>
            <XCircle size={56} className="mx-auto text-[hsl(0,65%,55%)]"/>
            <h1 className="font-display font-black text-2xl mt-4">Payment not found</h1>
            <p className="text-sm text-muted-foreground mt-2">We couldn't find a payment for that session. Please try starting checkout again.</p>
            <Link to="/programs"><Button className="btn-pill mt-6">Back to programs</Button></Link>
          </>
        )}
        {(state.status === "timeout" || state.status === "error") && (
          <>
            <Loader2 size={48} className="mx-auto text-muted-foreground"/>
            <h1 className="font-display font-black text-2xl mt-4">Still processing…</h1>
            <p className="text-sm text-muted-foreground mt-2">This is taking longer than usual. Check your programs page in a minute — we'll email you when it clears.</p>
            <Link to="/programs"><Button className="btn-pill mt-6">Back to programs</Button></Link>
          </>
        )}
      </Card>
    </div>
  );
}
