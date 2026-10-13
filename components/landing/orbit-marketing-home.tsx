import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, BrainCircuit, CheckCircle2, Compass,
  Fingerprint, GitBranch, GraduationCap, Layers3, LockKeyhole,
  Play, ShieldCheck, Sparkles, Target, Waypoints
} from "lucide-react";
import "./orbit-marketing-home.css";

const abilities=[
  {id:"python",name:"Python",x:68,y:86,state:"verified",hint:"Evidence"},
  {id:"sql",name:"SQL",x:290,y:90,state:"verified",hint:"Evidence"},
  {id:"stats",name:"Statistics",x:115,y:245,state:"growth",hint:"Building"},
  {id:"ml",name:"Model evaluation",x:322,y:261,state:"growth",hint:"Building"},
  {id:"deploy",name:"Deployment",x:219,y:390,state:"unknown",hint:"Unknown"}
] as const;
const edges:[string,string][]=[
  ["python","stats"],["python","ml"],["sql","ml"],["stats","ml"],["ml","deploy"]
];
function SkillUniverse(){
  const byId=(id:string)=>abilities.find(a=>a.id===id)!;
  return <div className="oh-universe" aria-label="Illustrative skill universe with interconnected capabilities">
    <div className="oh-universe-label"><span className="oh-pulse"/> LIVING SKILLTWIN <span>ILLUSTRATION</span></div>
    <svg className="oh-universe-svg" viewBox="0 0 440 462" role="img" aria-label="Example skill network connecting verified Python and SQL with developing statistics, model evaluation and unknown deployment">
      <defs>
        <radialGradient id="oh-aura"><stop offset="0" stopColor="#9283ff" stopOpacity=".22"/><stop offset="1" stopColor="#9283ff" stopOpacity="0"/></radialGradient>
        <linearGradient id="oh-edge" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#766fe3"/><stop offset="1" stopColor="#48d8bb"/></linearGradient>
      </defs>
      <circle cx="223" cy="235" r="178" stroke="#9d93d8" strokeDasharray="2 11" strokeOpacity=".22" fill="none"/>
      <circle cx="223" cy="235" r="116" stroke="#9d93d8" strokeOpacity=".16" fill="none"/>
      <circle cx="223" cy="235" r="125" fill="url(#oh-aura)" className="oh-aura"/>
      {edges.map(([a,b])=><line key={a+b} x1={byId(a).x} y1={byId(a).y} x2={byId(b).x} y2={byId(b).y} stroke="url(#oh-edge)" strokeWidth="1.7" strokeOpacity=".54" strokeDasharray={b==="deploy"?"5 8":undefined}/>)}
      <circle cx="219" cy="197" r="47" fill="#2d245a" stroke="#9f8dff" strokeWidth="1.4"/>
      <circle cx="219" cy="197" r="33" fill="#4a3995" strokeOpacity=".8"/>
      <path d="M219 174 L242 197 L219 220 L196 197Z" fill="none" stroke="#f5f1ff" strokeWidth="2.4"/>
      <circle cx="219" cy="197" r="6" fill="#f9f7ff"/>
      {abilities.map((item,i)=>{
        const tint=item.state==="verified"?"#50e2c4":item.state==="growth"?"#f9c678":"#8da0c7";
        return <g key={item.id} className={"oh-network-node oh-network-node-"+i}>
          <circle cx={item.x} cy={item.y} r="25" fill={tint} opacity=".12"/>
          <circle cx={item.x} cy={item.y} r="12" fill="#121a34" stroke={tint} strokeWidth="2.7"/>
          <circle cx={item.x} cy={item.y} r="3.5" fill={tint}/>
          <text x={item.x} y={item.y+(item.y>310?-32:34)} fill="#f1f3ff" fontSize="12" fontWeight="650" textAnchor="middle">{item.name}</text>
          <text x={item.x} y={item.y+(item.y>310?-17:49)} fill={tint} fontSize="9" textAnchor="middle">{item.hint}</text>
        </g>;
      })}
    </svg>
    <div className="oh-proof-chip"><ShieldCheck size={17}/><span><b>Proof changes the picture</b><small>Capability + confidence stay distinct</small></span></div>
    <div className="oh-evolve-chip"><GitBranch size={16}/><span>Understand every PlanDiff</span></div>
  </div>;
}

const journey=[
  {step:"01",icon:Compass,title:"Find your direction",description:"Explore careers and select the skills your target actually requires."},
  {step:"02",icon:BrainCircuit,title:"Build your Twin",description:"Bring your existing skills, projects and evidence into one evolving model."},
  {step:"03",icon:Fingerprint,title:"Prove your progress",description:"Challenge an estimate and see what your evidence truly supports."},
  {step:"04",icon:GitBranch,title:"Evolve your roadmap",description:"Follow clear milestones, with changes explained instead of hidden."}
];

export default function OrbitMarketingHome(){
  return <main className="oh-site">
    <div className="oh-ambient oh-ambient-one" aria-hidden="true"/>
    <div className="oh-ambient oh-ambient-two" aria-hidden="true"/>
    <header className="oh-header">
      <Link href="/" className="oh-brand" aria-label="SkillTwin home"><span className="oh-brand-symbol"><span/></span><span>SkillTwin<span className="oh-brand-dot">.</span></span><span className="oh-wordmark-tag">ORBIT</span></Link>
      <nav aria-label="Main navigation" className="oh-header-nav">
        <a href="#how-it-works">How it works</a>
        <a href="#why-skilltwin">Why SkillTwin</a>
        <Link href="/orbit-lab">Interactive demo</Link>
      </nav>
      <div className="oh-header-actions"><Link className="oh-signin" href="/login?next=%2Forbit-beta">Sign in</Link><Link className="oh-header-start" href="/orbit-onboarding">Get started <ArrowUpRight size={15}/></Link></div>
    </header>
    <section className="oh-hero">
      <div className="oh-hero-copy">
        <div className="oh-eyebrow"><Sparkles size={15}/> NOT JUST A ROADMAP. A LIVING SKILLTWIN.</div>
        <h1>Your next chapter <em>isn't a straight line.</em></h1>
        <p>Meet a learning experience that understands your evidence, maps your skills to your ambitions and evolves your plan as you grow.</p>
        <div className="oh-hero-actions">
          <Link href="/orbit-onboarding" className="oh-action-primary">Build my SkillTwin <ArrowRight size={18}/></Link>
          <Link href="/orbit-lab" className="oh-action-secondary"><Play size={16}/> Explore interactive demo</Link>
        </div>
        <div className="oh-trust"><span><CheckCircle2 size={15}/> Evidence before assumptions</span><span><LockKeyhole size={15}/> Your private learning journey</span></div>
      </div>
      <SkillUniverse/>
    </section>
    <section className="oh-journey" id="how-it-works">
      <div className="oh-section-top"><div><p className="oh-section-kicker">A DIFFERENT WAY FORWARD</p><h2>From ambition to <em>real progress.</em></h2></div><p>A connected cycle that learns with you—not another collection of disconnected courses.</p></div>
      <div className="oh-journey-grid">{journey.map(step=><article className="oh-journey-item" key={step.step}><div className="oh-journey-step"><span>{step.step}</span><step.icon size={20}/></div><h3>{step.title}</h3><p>{step.description}</p></article>)}</div>
    </section>
    <section className="oh-proof-section" id="why-skilltwin">
      <div className="oh-proof-showcase"><div className="oh-mini-eyebrow"><Waypoints size={15}/> EVIDENCE-LED ADAPTATION</div>
        <div className="oh-showcase-cards"><div className="oh-showcase-before"><span>WHAT YOU CLAIM</span><b>Python</b><small>Current capability needs validation</small></div><div className="oh-showcase-arrow"><ArrowRight size={22}/></div><div className="oh-showcase-after"><span>WHAT YOU PROVE</span><b>Validated evidence</b><small>Model and next action reconsidered</small></div></div>
        <div className="oh-showcase-foot"><ShieldCheck size={16}/> Example interaction · no manufactured scores or results</div>
      </div>
      <div className="oh-proof-copy"><p className="oh-section-kicker">EVIDENCE IS THE DIFFERENCE</p><h2>Don't just track effort. <em>Understand growth.</em></h2><p>SkillTwin separates what you can demonstrate from how confident the estimate is. New evidence updates your Twin, and your roadmap changes only when the result warrants it.</p>
        <div className="oh-bullets"><span><Layers3 size={17}/> Connected skill dependencies</span><span><Target size={17}/> Role-relative learning priorities</span><span><GitBranch size={17}/> Explainable plan decisions</span></div>
        <Link href="/orbit-onboarding">Start your journey <ArrowRight size={16}/></Link>
      </div>
    </section>
    <section className="oh-bottom-cta"><GraduationCap size={29}/><h2>The next version of you<br/><em>starts with what you know.</em></h2><p>Explore. Learn. Prove. Evolve.</p><Link href="/orbit-onboarding">Build your SkillTwin <ArrowRight size={17}/></Link></section>
    <footer className="oh-footer"><span className="oh-brand-footer">SkillTwin<span>.</span> <small>ORBIT</small></span><span>Adaptive learning, grounded in evidence.</span><div><Link href="/login?next=%2Forbit-beta">Sign in</Link><Link href="/orbit-lab">Demo</Link></div></footer>
  </main>;
}
