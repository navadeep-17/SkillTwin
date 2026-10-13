import { Sparkles, ShieldCheck } from "lucide-react";
import "./orbit-loading.css";

type Props={label?:string;detail?:string};
export function OrbitLoading({label="Preparing your SkillTwin",detail="Retrieving your saved learner state…"}:Props){
  return <main className="orbit-loading-shell" role="status" aria-live="polite" aria-busy="true">
    <div className="orbit-loading-inner">
      <div className="orbit-loading-mark" aria-hidden="true"><div className="orbit-loading-ring"/><div className="orbit-loading-core"><Sparkles size={27}/></div></div>
      <p className="orbit-loading-kicker">SKILLTWIN ORBIT</p>
      <h1>{label}</h1>
      <p>{detail}</p>
      <div className="orbit-loading-bar" aria-label="Loading in progress"><span/></div>
      <small><ShieldCheck size={14}/> Waiting for actual application state · no simulated percentages</small>
      <div className="orbit-loading-skeleton" aria-hidden="true">
        <div><i/><i/><i/></div><div><i/><i/><i/></div>
      </div>
    </div>
  </main>;
}
