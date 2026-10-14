"use client";
import { useEffect, useState } from "react";
import { Gift, Zap, Copy, ShieldCheck } from "lucide-react";
type Tx = { delta:number;reason:string;created_at:string };
type Wallet = { balance:number;referralCode:string;welcomeSparks:number;rewardSparks:number;chargingEnabled:boolean;prices:Record<string,number>;transactions:Tx[] };
export function SparksWalletView() {
  const [wallet,setWallet]=useState<Wallet|null>(null);
  const [error,setError]=useState("");
  const [copied,setCopied]=useState(false);
  useEffect(()=>{
    let active=true;
    fetch("/api/sparks",{cache:"no-store"}).then(async res=>{
      const json=await res.json();
      if(!res.ok||!json.ok)throw Error(json.error?.message||"Could not load Sparks");
      if(active)setWallet(json.data as Wallet);
    }).catch(e=>{if(active)setError(e instanceof Error?e.message:"Unable to load wallet");});
    return ()=>{active=false;};
  },[]);
  async function copy() {
    if(!wallet)return;
    const url=new URL("/login",window.location.origin);
    url.searchParams.set("ref",wallet.referralCode);
    try { await navigator.clipboard.writeText(url.toString());setCopied(true); }
    catch {setError("Copy was blocked. Try using your browser's copy option.");}
  }
  return <div className="space-y-7">
    <header><p className="eyebrow">SkillTwin Sparks</p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-950">Fuel your next breakthrough</h1>
      <p className="mt-2 text-sm text-slate-600">Your existing plans, learning tasks, skill progress and first career journey remain free.</p>
    </header>
    {error?<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>:null}
    {!wallet?<div className="rounded-2xl border bg-white p-8 text-sm text-slate-500">Loading your Sparks wallet…</div>:<>
      <section className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-indigo-700"><Zap size={20}/><span className="font-semibold">Available Sparks</span></div>
        <div className="mt-3 text-5xl font-semibold tracking-tight text-slate-950">{wallet.balance}</div>
        <p className="mt-2 text-sm text-slate-500">You started with {wallet.welcomeSparks} welcome Sparks.</p>
      </section>
      <section className="rounded-2xl border bg-white p-6">
        <div className="flex items-center gap-2 font-semibold"><Gift size={20}/>Give a friend a head start</div>
        <p className="mt-2 text-sm text-slate-600">You both earn {wallet.rewardSparks} Sparks after your friend verifies their account and begins a career journey. Up to five rewarded friends a month.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <code className="rounded-lg bg-slate-100 px-3 py-2 text-sm tracking-wider">{wallet.referralCode}</code>
          <button type="button" className="btn-primary" onClick={copy}><Copy size={15}/>{copied?"Link copied":"Copy invitation link"}</button>
        </div>
      </section>
      <section className="rounded-2xl border bg-white p-6">
        <h2 className="font-semibold">Optional AI features</h2>
        {!wallet.chargingEnabled?<p className="mt-2 text-sm text-indigo-700">Sparks spending is in preview. No credits are deducted yet.</p>:null}
        <div className="mt-3 space-y-3 text-sm">
          <div className="flex justify-between"><span>Custom career creation</span><strong>{wallet.prices.CUSTOM_ROLE} Sparks</strong></div>
          <div className="flex justify-between"><span>Project defense evaluation</span><strong>{wallet.prices.PROJECT_DEFENSE} Sparks</strong></div>
        </div>
        <p className="mt-4 flex gap-2 text-xs leading-5 text-slate-500"><ShieldCheck size={16} className="shrink-0"/>Failed AI actions are refunded. Your core career learning journey is not metered.</p>
      </section>
      <section className="rounded-2xl border bg-white p-6">
        <h2 className="font-semibold">Recent Sparks activity</h2>
        <div className="mt-4 divide-y divide-slate-100">
          {wallet.transactions.length===0?<p className="text-sm text-slate-500">No transactions yet.</p>:wallet.transactions.map((tx,i)=>
            <div key={i} className="flex justify-between gap-3 py-3 text-sm">
              <span className="text-slate-700">{tx.reason.replaceAll("_"," ").toLowerCase()}</span>
              <span className={tx.delta>0?"font-semibold text-emerald-700":"font-semibold text-slate-700"}>{tx.delta>0?"+":""}{tx.delta}</span>
            </div>)}
        </div>
      </section>
    </>}
  </div>;
}
