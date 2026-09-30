"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input, Select } from "@/components/ui/forms";
import { Button } from "@/components/ui/button";
import { REVIEW_STATUS_LABEL } from "@/lib/reviews/validation";
import { TRF_RECEIPT_STATUS_LABEL } from "@/lib/receipts/validation";

export function ReviewFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(sp.get("q") ?? "");

  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams(sp.toString());
      if (q) params.set("q", q); else params.delete("q");
      params.delete("page");
      startTransition(() => router.replace(`${pathname}?${params.toString()}`));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value && value !== "all") params.set(key, value); else params.delete(key);
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`);
  }

  const hasFilters = sp.get("q") || sp.get("status") || sp.get("receipt") ;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search TRF, customer, sample…" className="pl-9" />
      </div>
      <Select className="w-48" defaultValue={sp.get("status") ?? "all"} onChange={(e) => setParam("status", e.target.value)}>
        <option value="all">All review statuses</option>
        {Object.entries(REVIEW_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </Select>
      <Select className="w-48" defaultValue={sp.get("receipt") ?? "all"} onChange={(e) => setParam("receipt", e.target.value)}>
        <option value="all">All receipt statuses</option>
        {Object.entries(TRF_RECEIPT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </Select>
      {hasFilters ? <Button variant="ghost" size="sm" onClick={() => router.replace(pathname)}><X className="h-3.5 w-3.5" /> Clear filters</Button> : null}
    </div>
  );
}
