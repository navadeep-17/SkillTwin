"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
type PriceAction="CUSTOM_ROLE"|"PROJECT_DEFENSE";
type Snapshot={balance:number;chargingEnabled:boolean;prices:Record<PriceAction,number>};
export function SparksActionPrice({action,label}:{action:PriceAction;label:string}){
  const [wallet,setWallet]=useState<Snapshot|null>(null);
  useEffect(()=>{
    let live=true;
    fetch("/api/sparks",{cache:"no-store"}).then(r=>r.json())
      .then(body=>{if(live&&body.ok)setWallet(body.data as Snapshot);})
      .catch(()=>{});
    return ()=>{live=false;};
  },[]);
  if(!wallet)return null;
  const price=wallet.prices[action];
  return <p className="mt-3 text-xs leading-5 text-slate-600" role="note">
    {wallet.chargingEnabled
      ?label+": "+price+" Sparks · Available "+wallet.balance
      :label+": "+price+" Sparks (preview; no deductions yet)."}
    {wallet.chargingEnabled&&wallet.balance<price
      ?<>{" "}Not enough Sparks. <Link href="/sparks" className="font-semibold text-indigo-700 underline">Earn more</Link>.</>
      :null}
  </p>;
}
