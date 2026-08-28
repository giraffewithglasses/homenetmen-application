import React, { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Wallet, TrendingUp, TrendingDown, Plus, Building2, Trash2, DollarSign, Calendar } from "lucide-react";

const fmt = (v) => `֏${Number(v || 0).toLocaleString()}`;

export default function Finance() {
  const { user } = useAuth();
  const [chapters, setChapters] = useState([]);
  const [scope, setScope] = useState(user?.role === "national_admin" ? "all" : (user?.chapter_id || "national"));
  const [summary, setSummary] = useState(null);
  const [txns, setTxns] = useState([]);
  const [cats, setCats] = useState({ categories: [], income_categories: [] });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ kind: "income", category: "Donations", amount: 0, date: new Date().toISOString().slice(0, 10), description: "" });

  const canEdit = user && ["national_admin", "chapter_admin", "chapter_leader"].includes(user.role);

  useEffect(() => {
    api.get("/finance/categories").then(r => setCats(r.data)).catch(() => {});
    if (user?.role === "national_admin") {
      api.get("/chapters").then(r => setChapters(r.data)).catch(() => {});
    }
  }, [user?.role]);

  const load = () => {
    const params = scope === "all" ? "" : `?chapter_id=${scope}`;
    api.get(`/finance/summary${params}`).then(r => setSummary(r.data)).catch(() => setSummary(null));
    const txnParams = scope === "all" ? "" : `?chapter_id=${scope}`;
    api.get(`/finance/transactions${txnParams}`).then(r => setTxns(r.data)).catch(() => setTxns([]));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [scope]);

  const save = async () => {
    try {
      const payload = { ...form, amount: Number(form.amount) };
      if (user.role === "national_admin") payload.chapter_id = scope === "national" || scope === "all" ? null : scope;
      await api.post("/finance/transactions", payload);
      toast.success("Transaction recorded");
      setOpen(false);
      setForm({ kind: "income", category: "Donations", amount: 0, date: new Date().toISOString().slice(0, 10), description: "" });
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const remove = async (tid) => {
    if (!window.confirm("Delete this transaction?")) return;
    try { await api.delete(`/finance/transactions/${tid}`); toast.success("Deleted"); load(); }
    catch { toast.error("Failed"); }
  };

  const availableCategories = useMemo(() => {
    const inc = new Set(cats.income_categories || []);
    return (cats.categories || []).filter(c => form.kind === "income" ? inc.has(c) : !inc.has(c));
  }, [cats, form.kind]);

  // Ensure the form.category matches kind
  useEffect(() => {
    if (availableCategories.length && !availableCategories.includes(form.category)) {
      setForm(f => ({ ...f, category: availableCategories[0] }));
    }
  }, [availableCategories]); // eslint-disable-line

  const isAll = user?.role === "national_admin" && scope === "all";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="uppercase-label flex items-center gap-2"><Wallet size={12}/> Ledger</div>
          <h1 className="font-display text-4xl lg:text-5xl font-black tracking-tight mt-1">Finance</h1>
          <p className="text-muted-foreground mt-2">Track income, expenses, and net worth across every chapter and national.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {user?.role === "national_admin" && (
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="w-[220px]" data-testid="finance-scope"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All (National + Chapters)</SelectItem>
                <SelectItem value="national">National only</SelectItem>
                {chapters.map(c => <SelectItem key={c.chapter_id} value={c.chapter_id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {canEdit && !isAll && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="btn-pill bg-[hsl(12,65%,63%)] hover:bg-[hsl(12,70%,55%)]" data-testid="fin-add-btn">
                  <Plus size={16} className="mr-2"/> Record transaction
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Record a transaction</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Type</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, kind: "income" })}
                        className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-colors ${form.kind === "income" ? "border-[hsl(149,40%,30%)] bg-[hsl(149,40%,30%)]/10" : "border-border"}`}
                        data-testid="fin-kind-income"
                      >
                        <TrendingUp size={18} className="text-[hsl(149,40%,30%)]"/>
                        <span className="text-sm font-bold">Income</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, kind: "expense" })}
                        className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-colors ${form.kind === "expense" ? "border-[hsl(0,65%,55%)] bg-[hsl(0,65%,55%)]/10" : "border-border"}`}
                        data-testid="fin-kind-expense"
                      >
                        <TrendingDown size={18} className="text-[hsl(0,65%,55%)]"/>
                        <span className="text-sm font-bold">Expense</span>
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                      <SelectTrigger data-testid="fin-category"><SelectValue/></SelectTrigger>
                      <SelectContent>
                        {availableCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Amount (AMD ֏)</Label>
                    <Input type="number" min="1" step="1" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} data-testid="fin-amount"/>
                  </div>
                  <div>
                    <Label>Date</Label>
                    <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} data-testid="fin-date"/>
                  </div>
                  <div>
                    <Label>Note (optional)</Label>
                    <Textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} data-testid="fin-description"/>
                  </div>
                  <Button onClick={save} className="btn-pill w-full bg-[hsl(149,40%,30%)]" data-testid="fin-save">Save</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {isAll && summary?.buckets && (
        <>
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="clay-card p-6" data-testid="fin-networth-card">
              <div className="uppercase-label flex items-center gap-2"><Wallet size={12}/> Grand net worth</div>
              <div className={`font-display text-4xl font-black mt-2 ${summary.grand_total.networth >= 0 ? "text-[hsl(149,40%,30%)]" : "text-[hsl(0,65%,55%)]"}`}>{fmt(summary.grand_total.networth)}</div>
              <div className="text-xs text-muted-foreground mt-1">Across national + all chapters</div>
            </Card>
            <Card className="clay-card p-6">
              <div className="uppercase-label flex items-center gap-2 text-[hsl(149,40%,30%)]"><TrendingUp size={12}/> Total income</div>
              <div className="font-display text-3xl font-black mt-2 text-[hsl(149,40%,30%)]">{fmt(summary.grand_total.income_total)}</div>
            </Card>
            <Card className="clay-card p-6">
              <div className="uppercase-label flex items-center gap-2 text-[hsl(0,65%,55%)]"><TrendingDown size={12}/> Total expenses</div>
              <div className="font-display text-3xl font-black mt-2 text-[hsl(0,65%,55%)]">{fmt(summary.grand_total.expense_total)}</div>
            </Card>
          </div>

          <Card className="clay-card p-6">
            <h3 className="font-display font-bold text-xl mb-4">Breakdown by chapter</h3>
            <div className="space-y-2">
              {summary.buckets.map(b => (
                <button
                  key={b.chapter_id || "national"}
                  onClick={() => setScope(b.chapter_id || "national")}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-border hover:border-[hsl(12,65%,63%)] hover:bg-[hsl(12,65%,63%)]/5 transition-colors text-left"
                  data-testid={`fin-bucket-${b.chapter_id || "national"}`}
                >
                  <div className="w-11 h-11 rounded-full bg-[hsl(149,40%,30%)]/15 text-[hsl(149,40%,30%)] flex items-center justify-center flex-shrink-0">
                    <Building2 size={18}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{b.name}</div>
                    <div className="text-xs text-muted-foreground">{b.transaction_count} transactions</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-display font-black text-lg ${b.networth >= 0 ? "text-[hsl(149,40%,30%)]" : "text-[hsl(0,65%,55%)]"}`}>{fmt(b.networth)}</div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Net worth</div>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </>
      )}

      {!isAll && summary && (
        <>
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="clay-card p-6" data-testid="fin-networth-card">
              <div className="uppercase-label flex items-center gap-2"><Wallet size={12}/> Net worth</div>
              <div className={`font-display text-4xl font-black mt-2 ${summary.networth >= 0 ? "text-[hsl(149,40%,30%)]" : "text-[hsl(0,65%,55%)]"}`}>{fmt(summary.networth)}</div>
              <div className="text-xs text-muted-foreground mt-1">{summary.chapter_name}</div>
            </Card>
            <Card className="clay-card p-6">
              <div className="uppercase-label flex items-center gap-2 text-[hsl(149,40%,30%)]"><TrendingUp size={12}/> Income</div>
              <div className="font-display text-3xl font-black mt-2 text-[hsl(149,40%,30%)]">{fmt(summary.income_total)}</div>
            </Card>
            <Card className="clay-card p-6">
              <div className="uppercase-label flex items-center gap-2 text-[hsl(0,65%,55%)]"><TrendingDown size={12}/> Expenses</div>
              <div className="font-display text-3xl font-black mt-2 text-[hsl(0,65%,55%)]">{fmt(summary.expense_total)}</div>
            </Card>
          </div>

          <Tabs defaultValue="monthly">
            <TabsList className="rounded-full">
              <TabsTrigger value="monthly" className="rounded-full">Monthly trend</TabsTrigger>
              <TabsTrigger value="categories" className="rounded-full">By category</TabsTrigger>
              <TabsTrigger value="transactions" className="rounded-full">Transactions ({txns.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="monthly">
              <Card className="clay-card p-6 mt-4">
                {summary.monthly?.length ? (
                  <MonthlyChart data={summary.monthly}/>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-8">No monthly data yet.</div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="categories">
              <Card className="clay-card p-6 mt-4">
                {summary.categories?.length ? (
                  <div className="space-y-2">
                    {summary.categories.map((c, i) => {
                      const max = Math.max(...summary.categories.map(x => x.total));
                      const pct = max ? (c.total / max) * 100 : 0;
                      const color = c.kind === "income" ? "hsl(149,40%,30%)" : "hsl(0,65%,55%)";
                      return (
                        <div key={i}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="flex items-center gap-2">
                              {c.kind === "income" ? <TrendingUp size={12} className="text-[hsl(149,40%,30%)]"/> : <TrendingDown size={12} className="text-[hsl(0,65%,55%)]"/>}
                              <span className="font-semibold">{c.category}</span>
                              <Badge variant="outline" className="rounded-full text-[10px] uppercase">{c.kind}</Badge>
                            </span>
                            <span className="font-bold">{fmt(c.total)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }}/>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-8">No category data yet.</div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="transactions">
              <Card className="clay-card p-6 mt-4">
                {txns.length ? (
                  <div className="divide-y divide-border">
                    {txns.map(t => (
                      <div key={t.txn_id} className="flex items-center gap-4 py-3" data-testid={`fin-txn-${t.txn_id}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${t.kind === "income" ? "bg-[hsl(149,40%,30%)]/15 text-[hsl(149,40%,30%)]" : "bg-[hsl(0,65%,55%)]/15 text-[hsl(0,65%,55%)]"}`}>
                          {t.kind === "income" ? <TrendingUp size={16}/> : <TrendingDown size={16}/>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">{t.category}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2"><Calendar size={10}/> {t.date}{t.description ? ` · ${t.description}` : ""}</div>
                        </div>
                        <div className={`font-display font-bold text-base ${t.kind === "income" ? "text-[hsl(149,40%,30%)]" : "text-[hsl(0,65%,55%)]"}`}>
                          {t.kind === "expense" ? "−" : "+"}{fmt(t.amount)}
                        </div>
                        {canEdit && (
                          <button
                            onClick={() => remove(t.txn_id)}
                            className="w-8 h-8 rounded-full text-muted-foreground hover:bg-[hsl(0,65%,55%)]/10 hover:text-[hsl(0,65%,55%)] flex items-center justify-center"
                            data-testid={`fin-del-${t.txn_id}`}
                          ><Trash2 size={14}/></button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-8">No transactions yet.</div>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function MonthlyChart({ data }) {
  const max = Math.max(1, ...data.map(m => Math.max(m.income, m.expense)));
  return (
    <div>
      <div className="flex items-end gap-3 h-56 border-b border-border pb-2">
        {data.map(m => (
          <div key={m.month} className="flex-1 flex flex-col items-center justify-end gap-1">
            <div className="w-full flex items-end justify-center gap-1 h-full">
              <div className="w-3 bg-[hsl(149,40%,30%)] rounded-t" style={{ height: `${(m.income / max) * 100}%` }} title={`Income: ֏${m.income.toLocaleString()}`}/>
              <div className="w-3 bg-[hsl(0,65%,55%)] rounded-t" style={{ height: `${(m.expense / max) * 100}%` }} title={`Expense: ֏${m.expense.toLocaleString()}`}/>
            </div>
            <div className="text-[10px] text-muted-foreground -rotate-45 origin-top-right whitespace-nowrap mt-4">{m.month}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-6 mt-6 text-xs">
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[hsl(149,40%,30%)] rounded"/> Income</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[hsl(0,65%,55%)] rounded"/> Expenses</div>
      </div>
    </div>
  );
}
