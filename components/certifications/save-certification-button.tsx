"use client";

import {useState} from "react";
import {useRouter} from "next/navigation";
import {BookmarkPlus,LoaderCircle,CheckCircle2} from "lucide-react";

type Props={certificationId:string;compact?:boolean};
export function SaveCertificationButton({certificationId,compact=false}:Props){
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [saved,setSaved]=useState(false);

  async function save(){
    if(busy)return;
    setBusy(true);setError("");
    try{
      const response=await fetch("/api/certifications/journey",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({certificationId})
      });
      const json=await response.json();
      if(!response.ok||!json.ok)
        throw new Error(json.error?.message??"Unable to save this certification.");
      setSaved(true);
      router.push("/certifications/journey");
    }catch(error){
      setError(error instanceof Error?error.message:"Could not save certification.");
    }finally{setBusy(false)}
  }
  return <div className="space-y-2">
    <button type="button" onClick={()=>void save()} disabled={busy||saved}
      className={"inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-60 "+
        (compact?"px-3 py-2 text-xs":"w-full px-4 py-3 text-sm")}>
      {busy?<LoaderCircle className="size-4 animate-spin"/>:
        saved?<CheckCircle2 className="size-4"/>:<BookmarkPlus className="size-4"/>}
      {busy?"Saving…":saved?"Saved to your journey":"Save to My Journey"}
    </button>
    {error?<p role="alert" className="text-xs text-red-700">{error}</p>:null}
  </div>;
}
