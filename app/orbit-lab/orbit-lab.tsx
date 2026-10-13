"use client";

import { useState } from "react";
import {
  Activity, ArrowRight, ArrowUpRight, BookOpen, BrainCircuit, Check,
  ChevronRight, CircleHelp, Compass, Fingerprint, GitBranch, Layers3,
  Play, RotateCcw, ShieldCheck, Sparkles, Target, WandSparkles, Zap
} from "lucide-react";

type Screen = "landing" | "today" | "challenge";
const nodes = [
  { id: "python", label: "Python", x: 72, y: 94, status: "proof" },
  { id: "sql", label: "SQL", x: 260, y: 88, status: "ready" },
  { id: "ml", label: "Machine learning", x: 306, y: 224, status: "learning" },
  { id: "evaluation", label: "Model evaluation", x: 80, y: 243, status: "learning" },
  { id: "api", label: "APIs", x: 348, y: 334, status: "unknown" },
  { id: "git", label: "Git", x: 94, y: 359, status: "ready" }
] as const;
const paths = [["python", "ml"], ["sql", "ml"], ["evaluation", "ml"], ["git", "evaluation"], ["ml", "api"]] as const;
const nodeColor: Record<string, string> = { proof: "#a99aff", ready: "#52e7c7", learning: "#f7c67e", unknown: "#8290af" };
const initialTasks = [
  { id: "review", label: "Review model evaluation fundamentals", detail: "Learn · 25 min", category: "LEARN" },
  { id: "practice", label: "Practice confusion matrix scenarios", detail: "Practice · 20 min", category: "PRACTICE" },
  { id: "verify", label: "Challenge your Python estimate", detail: "Proof challenge · 10 min", category: "PROVE" }
];

function TwinMark({ small = false }: { small?: boolean }) {
  return (
    <span className={small ? "orbit-mark orbit-mark-small" : "orbit-mark"} aria-hidden="true">
      <span className="orbit-mark-core" /><span className="orbit-mark-dot" />
    </span>
  );
}
function Constellation({ compact = false, interactive = false, onPick }: { compact?: boolean; interactive?: boolean; onPick?: (name: string) => void }) {
  const [active, setActive] = useState("python");
  const find = (id: string) => nodes.find((n) => n.id === id)!;
  return (
    <div className={compact ? "orbit-universe compact" : "orbit-universe"}>
      <div className="orbit-universe-glow" />
      <svg className="orbit-map" viewBox="0 0 440 440" role="img" aria-label="Skill constellation showing connected skills and their evidence states">
        <defs>
          <radialGradient id="orbit-center-fill"><stop offset="0" stopColor="#a99aff" stopOpacity=".28" /><stop offset="1" stopColor="#a99aff" stopOpacity="0" /></radialGradient>
          <linearGradient id="orbit-connection" x1="0" x2="1"><stop offset="0" stopColor="#4c4a82" /><stop offset="1" stopColor="#998cfa" /></linearGradient>
        </defs>
        <circle cx="214" cy="216" r="156" stroke="#a49dff" strokeOpacity=".1" strokeDasharray="3 8" fill="none" />
        <circle cx="214" cy="216" r="111" stroke="#a49dff" strokeOpacity=".12" fill="none" />
        {paths.map(([a,b],i) => <line key={i} x1={find(a).x} y1={find(a).y} x2={find(b).x} y2={find(b).y} stroke="url(#orbit-connection)" strokeWidth="1.5" opacity={active === a || active === b ? .86 : .3} strokeDasharray={active === a || active === b ? undefined : "3 7"} />)}
        <circle cx="214" cy="216" r="98" fill="url(#orbit-center-fill)" className="orbit-heart-halo" />
        <circle cx="214" cy="216" r="51" fill="#25204c" stroke="#8f82ff" strokeWidth="1.5" />
        <circle cx="214" cy="216" r="36" fill="#5141b8" opacity=".7" />
        <path d="M214 193 L237 216 L214 239 L191 216 Z" fill="none" stroke="#d7d0ff" strokeWidth="2.5" />
        <circle cx="214" cy="216" r="7" fill="#f4f1ff" />
        {nodes.map((n) => <g key={n.id} className={interactive ? "orbit-pickable" : undefined} role={interactive ? "button" : undefined} tabIndex={interactive ? 0 : undefined} aria-label={interactive ? "Inspect " + n.label : undefined} onClick={() => { if (!interactive) return; setActive(n.id); onPick?.(n.label); }} onKeyDown={(e) => { if (interactive && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setActive(n.id); onPick?.(n.label); }}}>
          <circle cx={n.x} cy={n.y} r={active === n.id ? 24 : 20} fill={nodeColor[n.status]} opacity=".12" />
          <circle cx={n.x} cy={n.y} r={active === n.id ? 13 : 10} fill="#151a33" stroke={nodeColor[n.status]} strokeWidth={active === n.id ? 3 : 2} />
          <circle cx={n.x} cy={n.y} r="3.5" fill={nodeColor[n.status]} />
          <text x={n.x} y={n.y + (n.y > 310 ? -27 : 34)} fill="#d8e0f9" fontSize="11.5" textAnchor="middle" fontWeight="600">{n.label}</text>
        </g>)}
      </svg>
      {!compact && <div className="orbit-float-note"><span className="orbit-live-dot" /> Evidence-linked skill map <span className="orbit-note-symbol">✧</span></div>}
    </div>
  );
}
function TinySparkline() {
  return <svg className="orbit-sparkline" viewBox="0 0 340 90" role="img" aria-label="Illustrative readiness trend increasing over time"><defs><linearGradient id="orbit-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8878ff" stopOpacity=".32" /><stop offset="1" stopColor="#8878ff" stopOpacity="0" /></linearGradient></defs><path d="M8 78 L62 65 L110 69 L165 43 L222 48 L277 29 L330 14 L330 88 L8 88Z" fill="url(#orbit-area)" /><path d="M8 78 L62 65 L110 69 L165 43 L222 48 L277 29 L330 14" fill="none" stroke="#ad9cff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="orbit-line-draw" /><circle cx="330" cy="14" r="5" fill="#56e9c6" /><line x1="8" x2="330" y1="88" y2="88" stroke="#59627d" opacity=".4" /></svg>;
}
export default function OrbitLab() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [done, setDone] = useState<string[]>([]);
  const [pickedSkill, setPickedSkill] = useState("Python");
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [result, setResult] = useState(false);
  const correct = selectedAnswer === 1;
  const finishedCount = done.length;
  const go = (next: Screen) => { setScreen(next); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const toggle = (id: string) => setDone((d) => d.includes(id) ? d.filter((x) => x !== id) : [...d, id]);
  return <div className="orbit-lab">
    <div className="orbit-ambient orbit-ambient-a" /><div className="orbit-ambient orbit-ambient-b" />
    <header className="orbit-header">
      <a className="orbit-logo" href="#orbit" onClick={(e) => { e.preventDefault(); go("landing"); }}><TwinMark /><span>SkillTwin<span className="orbit-logo-period">.</span></span><span className="orbit-logo-tag">ORBIT</span></a>
      <nav aria-label="Prototype screens" className="orbit-nav">{([{ id:"landing",label:"Landing" },{ id:"today",label:"Today" },{ id:"challenge",label:"Challenge" }] as const).map((x) => <button key={x.id} className={screen === x.id ? "active" : ""} aria-current={screen === x.id ? "page" : undefined} onClick={() => go(x.id)}>{x.label}</button>)}</nav>
      <span className="orbit-preview-pill"><span className="orbit-live-dot" /> Concept prototype</span>
    </header>
    <main key={screen} className="orbit-content orbit-enter">
      {screen === "landing" && <>
        <div className="orbit-landing-hero">
          <div className="orbit-landing-copy">
            <div className="orbit-kicker"><Sparkles size={14} /> THE FUTURE IS NOT A STRAIGHT LINE</div>
            <h1>Meet the AI that <em>evolves</em> with you.</h1>
            <p>Your skills aren't static. Neither should your learning plan be. SkillTwin sees your evidence, helps you prove what you know, and adapts as you grow.</p>
            <div className="orbit-cta-row"><button className="orbit-btn orbit-btn-primary" onClick={() => go("today")}>Explore your Twin <ArrowRight size={17}/></button><button className="orbit-btn orbit-btn-ghost" onClick={() => go("challenge")}><Play size={16}/> See proof in action</button></div>
            <div className="orbit-trust-line"><span className="orbit-live-dot"/> Evidence first <span>✦</span> Explained decisions <span>✦</span> Always yours</div>
          </div>
          <div className="orbit-landing-visual"><Constellation /><div className="orbit-floating-stat orbit-stat-a"><ShieldCheck size={18}/><span><strong>Proof, not promises</strong><small>Evidence-backed skills</small></span></div><div className="orbit-floating-stat orbit-stat-b"><GitBranch size={18}/><span><strong>Plans that respond</strong><small>Every change explained</small></span></div></div>
        </div>
        <section className="orbit-bottom-features" aria-label="How SkillTwin works">
          {[{ icon: Fingerprint, title:"Understand your starting point",body:"Claims, projects and assessment evidence shape a Twin with explicit uncertainty." }, { icon: Target,title:"See the path ahead",body:"Discover role-relative gaps and a clear next step, without endless disconnected courses." }, { icon: Zap,title:"Challenge and evolve",body:"Verify a skill, inspect the result and see why your plan changed—or stayed the same." }].map((f) => <article className="orbit-feature" key={f.title}><span className="orbit-feature-icon"><f.icon size={21}/></span><h3>{f.title}</h3><p>{f.body}</p></article>)}
        </section>
      </>}
      {screen === "today" && <>
        <div className="orbit-section-head"><div><div className="orbit-kicker"><span className="orbit-live-dot"/> YOUR PERSONAL MISSION CONTROL</div><h1>Every skill has a story.<br/><em>Here's your next chapter.</em></h1><p>One clear next move, with the entire journey one step away.</p></div><div className="orbit-date-pill"><Activity size={15}/> Demo learner · ML Engineer</div></div>
        <section className="orbit-today-grid">
          <div className="orbit-panel orbit-hero-panel">
            <div className="orbit-panel-overline"><BrainCircuit size={16}/> YOUR LIVING TWIN <span>ILLUSTRATIVE DATA</span></div>
            <div className="orbit-mini-universe"><Constellation compact interactive onPick={setPickedSkill}/></div>
            <div className="orbit-twin-footer"><div><span>Selected skill</span><strong>{pickedSkill}</strong><small>Explore the skill network • Click a node</small></div><button className="orbit-icon-button" aria-label="Open proof challenge" onClick={() => go("challenge")}><ArrowUpRight size={20}/></button></div>
          </div>
          <div className="orbit-today-right">
            <div className="orbit-panel orbit-readiness-panel"><div className="orbit-panel-overline"><Target size={16}/> YOUR ROLE READINESS</div><div className="orbit-readiness-main"><strong>68<span>%</span></strong><span className="orbit-chip orbit-chip-mint">Sample +9 pts</span></div><p>Illustrative role-relative estimate. Verify skills to build stronger evidence.</p><TinySparkline/><div className="orbit-chart-bottom"><span>Past snapshots</span><span>Latest</span></div></div>
            <div className="orbit-panel orbit-task-panel"><div className="orbit-task-title"><div><div className="orbit-panel-overline"><Zap size={15}/> YOUR NEXT MOVES</div><h2>Make progress today</h2></div><span className="orbit-count">{finishedCount}/3</span></div><div className="orbit-task-progress"><span style={{width:(finishedCount / 3 * 100)+"%"}}/></div><div className="orbit-task-list">{initialTasks.map((task) => <button key={task.id} className={"orbit-task " + (done.includes(task.id) ? "orbit-task-done" : "")} onClick={() => toggle(task.id)} aria-pressed={done.includes(task.id)}><span className="orbit-task-check">{done.includes(task.id) && <Check size={13}/>}</span><span><strong>{task.label}</strong><small>{task.detail}</small></span><ChevronRight size={16}/></button>)}</div><button className="orbit-link-action" onClick={() => go("challenge")}>Start a proof challenge <ArrowRight size={16}/></button></div>
          </div>
        </section>
        <section className="orbit-under-row"><div className="orbit-micro-panel"><div className="orbit-panel-overline"><Layers3 size={15}/> THE NEXT MILESTONE</div><strong>Validate your capabilities</strong><p>Turn what your resume claims into stronger, assessed evidence.</p></div><div className="orbit-micro-panel"><div className="orbit-panel-overline"><Compass size={15}/> HOW YOUR TWIN WORKS</div><strong>Every decision is traceable</strong><p>See the evidence behind an estimate, and what made a roadmap change.</p></div></section>
      </>}
      {screen === "challenge" && <>
        <div className="orbit-section-head orbit-challenge-top"><div><div className="orbit-kicker"><Fingerprint size={15}/> CHALLENGE MY TWIN</div><h1>Don't just trust your Twin.<br/><em>Put it to the test.</em></h1><p>A signature evidence-to-adaptation experience, shown with safe sample data.</p></div><button className="orbit-btn orbit-btn-ghost" onClick={() => {setResult(false);setSelectedAnswer(null);}}><RotateCcw size={16}/> Reset demo</button></div>
        <div className="orbit-proof-layout">
          <div className="orbit-panel orbit-proof-main">
            <div className="orbit-proof-header"><span className="orbit-proof-icon"><BrainCircuit size={25}/></span><div><div className="orbit-panel-overline">SKILL UNDER REVIEW</div><h2>Python foundations</h2><p>We currently have limited independent proof of advanced proficiency.</p></div></div>
            {!result ? <div className="orbit-question-block"><div className="orbit-question-meta"><span>DEMO QUESTION · 1 OF 1</span><span className="orbit-chip">Single choice</span></div><h3>Which Python pattern creates an independent list of squared values without changing the source list?</h3><div className="orbit-answers">{["numbers.sort()","[n ** 2 for n in numbers]","numbers.append(2)","del numbers[:]"].map((option,i) => <button type="button" key={option} className={"orbit-answer "+(selectedAnswer===i?"selected":"")} aria-pressed={selectedAnswer===i} onClick={()=>setSelectedAnswer(i)}><span className="orbit-answer-letter">{String.fromCharCode(65+i)}</span>{option}<span className="orbit-answer-indicator"/></button>)}</div><button disabled={selectedAnswer===null} className="orbit-btn orbit-btn-primary orbit-submit" onClick={()=>setResult(true)}>Submit demo answer <ArrowRight size={17}/></button></div> :
              <div className="orbit-result-block" aria-live="polite"><span className="orbit-result-symbol">{correct?<ShieldCheck size={32}/>:<CircleHelp size={32}/>}</span><div className="orbit-kicker">{correct?"DEMONSTRATED IN THIS SAMPLE":"SAMPLE ANSWER REVIEW"}</div><h3>{correct?"New evidence can strengthen an estimate.":"One incorrect answer is not a verdict."}</h3><p>{correct?"You selected the sample correct answer. The real product would evaluate a full validated assessment before updating its canonical skill estimate.":"The correct choice was the list comprehension. A real evaluation would consider multiple questions, coverage and confidence before any learner-state decision."}</p><div className="orbit-result-compare"><div><span>Illustrative before</span><strong>1.6 <small>/ 4</small></strong></div><ArrowRight size={21}/><div><span>Illustrative after</span><strong>{correct?"2.1":"1.6"} <small>/ 4</small></strong></div></div><div className="orbit-replan-sample"><GitBranch size={19}/><span>{correct?"Potential adaptation: a prerequisite review could be shortened. No real plan was modified.":"Potential decision: keep the roadmap unchanged until stronger evidence is available."}</span></div><button className="orbit-btn orbit-btn-ghost" onClick={()=>{setResult(false);setSelectedAnswer(null);}}>Try again <RotateCcw size={16}/></button></div>}
          </div>
          <aside className="orbit-proof-side"><div className="orbit-panel orbit-evidence-panel"><div className="orbit-panel-overline"><ShieldCheck size={15}/> WHY THIS MATTERS</div><h3>Proof has a visible consequence.</h3><p>SkillTwin distinguishes capability from confidence and shows where its evidence comes from.</p><div className="orbit-proof-steps">{[{n:"01",t:"Twin makes a claim",d:"Estimated capability and uncertainty"},{n:"02",t:"You challenge it",d:"A targeted validation experience"},{n:"03",t:"Evidence is evaluated",d:"Against structured assessment rules"},{n:"04",t:"The roadmap responds",d:"A justified PlanDiff—or no change"}].map((s)=><div key={s.n}><span>{s.n}</span><div><strong>{s.t}</strong><small>{s.d}</small></div></div>)}</div></div><div className="orbit-warning"><WandSparkles size={18}/><p><strong>Concept mode.</strong> All values on this screen are illustrative and stay in this browser view. No assessment, score or roadmap is saved.</p></div></aside>
        </div>
      </>}
    </main>
    <footer className="orbit-footer"><div><TwinMark small/> SkillTwin Orbit <span>•</span> Interface exploration</div><span>Interactive concept • Demo data only • Production unaffected</span></footer>
  </div>;
}
