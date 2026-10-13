"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight, ArrowUpRight, CalendarDays, Check, CheckCircle2,
  ChevronRight, Clock3, Compass, Fingerprint, GitBranch,
  Hourglass, Layers3, Lightbulb, MapPinned, Network,
  RotateCcw, ShieldCheck, Sparkles, Target, Zap
} from "lucide-react";

export type JourneyTask = {
  id:string; objectiveId:string; type:string; title:string; status:string; minutes:number;
  dueAt:string | null; difficulty:string;
};
export type JourneyWeek = {
  id:string; index:number; startDate:string; endDate:string; capacityMinutes:number; plannedMinutes:number;
  rationale:string|null; objectives:Array<{id:string;type:string;name:string;successCriteria:string;targetScore:number}>;
  tasks:JourneyTask[];
};
export type JourneyDiff = {
  id:string;status:string;fromVersion:number;toVersion:number|null;summary:string;reason:string;
  operationsCount:number;timelineImpact:string;minuteDelta:number;touchCount:number;complexity:string;
  createdAt:string;appliedAt:string|null;
};
export type JourneyDecision = {
  id:string;decision:string;reasonCode:string;reason:string;material:boolean;fromVersion:number|null;
  triggerType:string;createdAt:string;
};
export type JourneyModel = {
  roleName:string|null;versions:number;
  plan:{id:string;version:number;startDate:string;endDate:string;plannedMinutes:number;adaptationBufferMinutes:number;createdAt:string}|null;
  weeks:JourneyWeek[];diffs:JourneyDiff[];decisions:JourneyDecision[];
};
type HistoryItem =
  | {id:string;kind:"diff";createdAt:string;diff:JourneyDiff}
  | {id:string;kind:"noop";createdAt:string;decision:JourneyDecision};
const pretty=(value:string)=>value.replaceAll("_"," ").toLowerCase().replace(/\b\w/g,x=>x.toUpperCase());
const formatMinutes=(minutes:number)=>{if(minutes<60)return minutes+"m";const hours=Math.floor(minutes/60);return hours+"h"+(minutes%60?" "+minutes%60+"m":"");};
const dateLabel=(input:string | null)=>input?new Date(input.length===10?input+"T12:00:00":input).toLocaleDateString("en-US",{month:"short",day:"numeric"}):"Not scheduled";
const isDone=(task:JourneyTask)=>task.status==="COMPLETED";
const countDone=(week:JourneyWeek)=>week.tasks.filter(isDone).length;
const completion=(week:JourneyWeek)=>week.tasks.length?Math.round(countDone(week)*100/week.tasks.length):0;
const impactTone=(status:string)=>status==="APPLIED"?"mint":status==="PROPOSED"?"violet":status==="REJECTED"||status==="UNDONE"?"amber":"muted";
function Metric({icon:Icon,title,value,sub}:{icon:typeof Target;title:string;value:string;sub:string}) {
  return <div className="oj-metric"><Icon size={18}/><span>{title}</span><strong>{value}</strong><small>{sub}</small></div>;
}
function WeekRail({weeks,active,onSelect}:{weeks:JourneyWeek[];active:string;onSelect:(value:string)=>void}){
  return <div className="oj-rail" aria-label="Journey milestone selector">
    {weeks.map((week,i)=>{
      const done=countDone(week),pct=completion(week),selected=active===week.id;
      return <button type="button" key={week.id} className={"oj-rail-stop"+(selected?" selected":"")}
        aria-pressed={selected} onClick={()=>onSelect(week.id)}>
        <span className="oj-rail-point">{pct===100 && week.tasks.length>0?<Check size={18}/>:String(week.index).padStart(2,"0")}</span>
        {i<weeks.length-1&&<span className="oj-rail-wire" aria-hidden="true"/>}
        <span className="oj-rail-label"><strong>Week {week.index}</strong><small>{dateLabel(week.startDate)} – {dateLabel(week.endDate)}</small></span>
        <span className="oj-rail-percent">{done}/{week.tasks.length}</span>
      </button>;
    })}
  </div>;
}
function TaskCard({task,focus}:{task:JourneyTask;focus:boolean}) {
  const done=isDone(task);
  return <article className={"oj-task"+(done?" completed":"")+(focus?" focus":"")}>
    <span className={"oj-task-status "+(done?"done":task.status==="IN_PROGRESS"?"active":"waiting")} aria-label={pretty(task.status)}>
      {done?<Check size={15}/>:task.status==="IN_PROGRESS"?<Zap size={14}/>:<span/>}
    </span>
    <div className="oj-task-body">
      <div className="oj-task-meta"><span>{pretty(task.type)}</span><span><Clock3 size={12}/>{formatMinutes(task.minutes)}</span></div>
      <h4>{task.title}</h4>
      <div className="oj-task-footer">
        <span>{pretty(task.status)}{task.dueAt?" · "+dateLabel(task.dueAt):""}</span>
        <Link href={"/roadmap/task/"+encodeURIComponent(task.id)} aria-label={"Open "+task.title+" in current roadmap"}>Open task <ArrowUpRight size={14}/></Link>
      </div>
    </div>
  </article>;
}
function DiffDetails({entry}:{entry:HistoryItem}){
  if(entry.kind==="noop"){
    const decision=entry.decision;
    return <div className="oj-change-detail">
      <div className="oj-change-detail-top"><span className="oj-change-badge mint"><ShieldCheck size={14}/> No changes necessary</span><span>Based on {pretty(decision.triggerType)}</span></div>
      <h3>Plan preserved intentionally</h3>
      <p>{decision.reason}</p>
      <div className="oj-change-stats"><span>Reason code <strong>{pretty(decision.reasonCode)}</strong></span><span>From plan <strong>{decision.fromVersion==null?"—":"v"+decision.fromVersion}</strong></span></div>
      <small>A NO_OP decision is a meaningful evaluation: your roadmap was not modified.</small>
    </div>;
  }
  const diff=entry.diff;
  return <div className="oj-change-detail">
    <div className="oj-change-detail-top"><span className={"oj-change-badge "+impactTone(diff.status)}><GitBranch size={14}/>{pretty(diff.status)}</span><span>{dateLabel(diff.createdAt)}</span></div>
    <h3>{diff.summary}</h3>
    <p>{diff.reason}</p>
    <div className="oj-change-stats"><span>Plan version <strong>v{diff.fromVersion} → {diff.toVersion==null?"Pending":"v"+diff.toVersion}</strong></span><span>Tasks affected <strong>{diff.touchCount}</strong></span><span>Time impact <strong>{diff.minuteDelta>0?"+":""}{diff.minuteDelta} min</strong></span><span>Timeline <strong>{pretty(diff.timelineImpact)}</strong></span></div>
    <small>{diff.operationsCount} recorded operations · {pretty(diff.complexity)} complexity</small>
    <Link href={"/roadmap/changes/"+encodeURIComponent(diff.id)}>Inspect full PlanDiff and available actions <ArrowRight size={15}/></Link>
  </div>;
}
export function OrbitJourney({model}:{model:JourneyModel}){
  const [selectedWeek,setSelectedWeek]=useState<string | null>(null);
  const [activeEvent,setActiveEvent]=useState<string | null>(null);
  const [showAll,setShowAll]=useState(false);
  const weeks=model.weeks;
  const currentWeek=weeks.find(w=>w.id===selectedWeek)??weeks.find(w=>w.tasks.some(t=>t.status==="IN_PROGRESS"))??weeks.find(w=>w.tasks.some(t=>!isDone(t)))??weeks[0]??null;
  const allTasks=useMemo(()=>weeks.flatMap(w=>w.tasks),[weeks]);
  const completedCount=allTasks.filter(isDone).length;
  const totalTasks=allTasks.length;
  const progress=totalTasks?Math.round(completedCount*100/totalTasks):0;
  const weekDone=currentWeek?countDone(currentWeek):0;
  const nextTask=allTasks.find(t=>t.status==="IN_PROGRESS")??allTasks.find(t=>t.status==="PLANNED")??null;
  const history=useMemo<HistoryItem[]>(()=>{
    const diffs:HistoryItem[]=model.diffs.map(diff=>({id:"diff-"+diff.id,kind:"diff" as const,createdAt:diff.createdAt,diff}));
    // The same triggering event can have both a decision and an APPLIED PlanDiff.
    // Only explicitly NO_OP decisions are listed separately to avoid double-counting changes.
    const noops:HistoryItem[]=model.decisions.filter(item=>item.decision==="NO_OP").map(decision=>({id:"noop-"+decision.id,kind:"noop" as const,createdAt:decision.createdAt,decision}));
    return [...diffs,...noops].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  },[model.diffs,model.decisions]);
  const chosenEvent=history.find(item=>item.id===activeEvent)??history[0]??null;
  const historyList=showAll?history:history.slice(0,5);
  return <div className="oj-main">
    <header className="oj-heading">
      <div><p className="orbit-kicker"><MapPinned size={16}/> YOUR PERSONAL LEARNING JOURNEY</p>
        <h1>A roadmap that <em>moves with you.</em></h1>
        <p>Explore milestones, understand your next action, and inspect exactly why SkillTwin adapted—or chose not to.</p>
      </div>
      <div className="oj-goal"><Compass size={19}/><div><small>Working toward</small><strong>{model.roleName??"No target role"}</strong></div></div>
    </header>
    {!model.plan ? <section className="oj-empty">
      <span><Sparkles size={32}/></span><h2>Your journey begins with evidence.</h2>
      <p>Choose a target, analyze your evidence, and generate your first plan. We won't manufacture milestones before SkillTwin has created a roadmap.</p>
      <Link href="/orbit-onboarding">Build my first roadmap <ArrowRight size={17}/></Link>
    </section> : <>
      <section className="oj-hero">
        <div className="oj-hero-copy"><span className="oj-kicker"><span className="orbit-live-dot"/> ACTIVE LEARNING PLAN · VERSION {model.plan.version}</span>
          <h2>Make your next move count.</h2>
          <p>{nextTask?nextTask.title:"All current plan tasks are completed or have no remaining planned action."}</p>
          <div className="oj-hero-actions">
            {nextTask?<Link href={"/roadmap/task/"+encodeURIComponent(nextTask.id)}>Continue this task <ArrowRight size={17}/></Link>:
              <Link href="/roadmap">View your plan <ArrowRight size={17}/></Link>}
            <span><Clock3 size={15}/>{nextTask?formatMinutes(nextTask.minutes)+" · "+pretty(nextTask.type):"No pending task"}</span>
          </div>
        </div>
        <div className="oj-hero-meter"><div className="oj-ring" style={{"--oj-progress":progress+"%"} as React.CSSProperties}>
          <div><strong>{progress}%</strong><small>Completed</small></div></div>
          <p>{completedCount} of {totalTasks} tasks <span>·</span> v{model.plan.version}</p></div>
      </section>
      <section className="oj-metrics" aria-label="Actual roadmap metrics">
        <Metric icon={Layers3} title="Milestones" value={String(weeks.length)} sub="Weeks in the saved plan"/>
        <Metric icon={CheckCircle2} title="Tasks completed" value={completedCount+" / "+totalTasks} sub="Persisted task statuses"/>
        <Metric icon={Clock3} title="Planned workload" value={formatMinutes(model.plan.plannedMinutes)} sub="Across the active plan"/>
        <Metric icon={RotateCcw} title="Plan versions" value={String(model.versions)} sub="For this career goal"/>
      </section>
      <section className="oj-section">
        <div className="oj-section-heading"><div><p className="orbit-kicker"><Network size={15}/> SPATIAL ROADMAP</p><h2>Milestones on your path</h2><p>Choose a week to see tasks, dependencies and the reason behind the plan.</p></div><span>Real saved milestones</span></div>
        {weeks.length? <div className="oj-roadmap">
          <div className="oj-rail-wrap"><WeekRail weeks={weeks} active={currentWeek?.id??""} onSelect={setSelectedWeek}/></div>
          {currentWeek&&<div className="oj-week-panel" key={currentWeek.id}>
            <div className="oj-week-header"><span className="oj-week-index">W{String(currentWeek.index).padStart(2,"0")}</span>
              <div><p>SELECTED MILESTONE</p><h3>Week {currentWeek.index}: {dateLabel(currentWeek.startDate)} – {dateLabel(currentWeek.endDate)}</h3></div>
              <span className="oj-week-state">{weekDone}/{currentWeek.tasks.length} completed</span></div>
            <p className="oj-week-rationale">{currentWeek.rationale??"Milestone aligned with current role requirements and available study time."}</p>
            <div className="oj-week-progress-head"><span>Task completion</span><strong>{completion(currentWeek)}%</strong></div>
            <div className="oj-progress" role="progressbar" aria-label={"Week "+currentWeek.index+" task completion"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={completion(currentWeek)}><span style={{width:completion(currentWeek)+"%"}}/></div>
            <div className="oj-capacity"><Hourglass size={15}/> {formatMinutes(currentWeek.plannedMinutes)} planned / {formatMinutes(currentWeek.capacityMinutes)} capacity</div>
            <div className="oj-objectives"><h4>Learning objectives <span>{currentWeek.objectives.length}</span></h4>
              {currentWeek.objectives.length?<div>{currentWeek.objectives.map(o=><div key={o.id}><span>{o.name}</span><small>{pretty(o.type)} · Target {o.targetScore.toFixed(1)}/4</small><p>{o.successCriteria}</p></div>)}</div>:<p>No objectives in this milestone.</p>}
            </div>
            <div className="oj-tasks-heading"><h4>Tasks for this week</h4><span>{currentWeek.tasks.length} total</span></div>
            <div className="oj-tasks">{currentWeek.tasks.length?currentWeek.tasks.map(t=><TaskCard key={t.id} task={t} focus={t.id===nextTask?.id}/>):<p className="oj-muted">No tasks are scheduled for this week.</p>}</div>
          </div>}
        </div>:<div className="oj-empty-mini">No week milestones were saved in this plan yet. <Link href="/roadmap">Check your original roadmap.</Link></div>}
      </section>
      <section className="oj-section oj-history-section">
        <div className="oj-section-heading"><div><p className="orbit-kicker"><GitBranch size={15}/> EXPLAINABLE ADAPTATION</p><h2>Every meaningful plan decision.</h2><p>PlanDiffs show what changed. NO_OP events explain why SkillTwin left your roadmap alone.</p></div><span>{history.length} recent events</span></div>
        {history.length?<div className="oj-history">
          <div className="oj-events">
            {historyList.map(item=>{
              const active=item.id===chosenEvent?.id;
              const isNoOp=item.kind==="noop";
              const title=isNoOp?"Plan preserved · "+pretty(item.decision.reasonCode):item.diff.summary;
              const status=isNoOp?"NO_OP":item.diff.status;
              return <button key={item.id} type="button" className={"oj-event"+(active?" selected":"")} aria-pressed={active} onClick={()=>setActiveEvent(item.id)}>
                <span className={"oj-event-icon "+(isNoOp?"mint":impactTone(status))}>{isNoOp?<ShieldCheck size={17}/>:<GitBranch size={17}/>}</span>
                <span><small>{dateLabel(item.createdAt)} · {pretty(status)}</small><strong>{title}</strong></span><ChevronRight size={16}/></button>;
            })}
            {history.length>5&&<button className="oj-history-more" type="button" onClick={()=>setShowAll(x=>!x)}>{showAll?"Show fewer events":"Show all "+history.length+" events"} <ArrowRight size={14}/></button>}
          </div>
          <div className="oj-history-detail" aria-live="polite">{chosenEvent&&<DiffDetails entry={chosenEvent}/>}</div>
        </div>:<div className="oj-empty-mini"><ShieldCheck size={22}/> No replan decisions are recorded yet. Your current version remains the source of truth.</div>}
      </section>
      <div className="oj-trust"><ShieldCheck size={18}/><span>This preview uses actual plan versions, task statuses and recorded replanning decisions. Animations visualize committed state only. Use the existing task and PlanDiff pages for any writes or approvals.</span></div>
      <footer className="oj-footer"><Link href="/orbit-skills">Understand my skill gaps <ArrowRight size={15}/></Link><Link href="/roadmap">Open the current working roadmap <ArrowUpRight size={15}/></Link></footer>
    </>}
  </div>;
}
