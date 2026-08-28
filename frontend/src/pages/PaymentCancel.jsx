import React from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

export default function PaymentCancel() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[hsl(42,30%,94%)]">
      <Card className="clay-card p-10 max-w-md w-full text-center" data-testid="payment-cancel-card">
        <XCircle size={56} className="mx-auto text-[hsl(0,65%,55%)]"/>
        <h1 className="font-display font-black text-2xl mt-4">Payment cancelled</h1>
        <p className="text-sm text-muted-foreground mt-2">No worries — you weren't charged. You can try again anytime.</p>
        <Link to="/programs"><Button className="btn-pill mt-6 bg-[hsl(12,65%,63%)] hover:bg-[hsl(12,70%,55%)]" data-testid="payment-cancel-back">Back to programs</Button></Link>
      </Card>
    </div>
  );
}
