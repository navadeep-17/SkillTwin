"use client";

import Link from "next/link";
import type {ReactNode} from "react";
import {
  Activity, ArrowRight, Award, BookOpen, Compass, FileCode2,
  Fingerprint, FolderKanban, MessageCircle, Settings2, ShieldCheck,
  TrendingUp, ScrollText
} from "lucide-react";
import type {LucideIcon} from "lucide-react";
import {OrbitPreviewNav} from "@/components/orbit/orbit-preview-nav";
import "@/app/orbit-lab/orbit-lab.css";
import "./orbit-secondary-workspace.css";

type Workspace={
  path:string;name:string;eyebrow:string;description:string;icon:LucideIcon;
};

export const secondaryWorkspaces:Workspace[]=[
  {path:"/certifications/journey",name:"My Certification Journey",eyebrow:"CREDENTIALS / PREPARATION",description:"Track saved credentials, exam goals, preparation topics and self-reported achievements.",icon:Award},
  {path:"/certifications",name:"Certifications",eyebrow:"CAREER LEARNING / CREDENTIALS",description:"Discover role-aligned certifications and save opportunities to your personal learning journey.",icon:Award},
  {path:"/project-defense",name:"Project Defense",eyebrow:"EVIDENCE / VALIDATION",description:"Inspect your public project repository and use the existing defense workflow to demonstrate what you built.",icon:FileCode2},
  {path:"/projects",name:"Projects",eyebrow:"EVIDENCE / PORTFOLIO",description:"Manage project evidence and review recommendations connected to your career direction.",icon:FolderKanban},
  {path:"/passport",name:"Evidence Passport",eyebrow:"EVIDENCE / PROVENANCE",description:"Review your saved skill evidence, verification states, and source-backed career narrative.",icon:ScrollText},
  {path:"/journey",name:"Ask SkillTwin",eyebrow:"LEARNER ASSISTANT",description:"Ask grounded questions about your progress and review confirmed agent actions.",icon:MessageCircle},
  {path:"/activity",name:"Agent Activity",eyebrow:"TRANSPARENCY / AUDIT TRAIL",description:"See recorded agent decisions, tool activity and observable learner-state events.",icon:Activity},
  {path:"/progress",name:"Progress & Reports",eyebrow:"LEARNING ANALYTICS",description:"Examine progress trends, evidence coverage and saved weekly learning reports.",icon:TrendingUp},
  {path:"/occupations",name:"Occupation Atlas",eyebrow:"CAREER RESEARCH",description:"Browse curated occupation records, source context and modeled career skill relationships.",icon:BookOpen},
  {path:"/settings",name:"Settings",eyebrow:"PREFERENCES / CONTROL",description:"Adjust learning notifications, reporting, motion and density without resetting your Twin.",icon:Settings2},
  {path:"/practice",name:"Practice Hub",eyebrow:"LEARN / VERIFY",description:"Continue existing practice and assessment workflows using saved learner-state evidence.",icon:Fingerprint}
];

export function findOrbitSecondaryWorkspace(pathname:string):Workspace|null {
  return secondaryWorkspaces.find(route=>
    pathname===route.path||pathname.startsWith(route.path+"/")
  )??null;
}
const quickLinks=[
  {path:"/certifications",label:"Certifications",icon:Award},
  {path:"/projects",label:"Projects",icon:FolderKanban},
  {path:"/project-defense",label:"Project Defense",icon:FileCode2},
  {path:"/passport",label:"Passport",icon:ScrollText},
  {path:"/journey",label:"Ask SkillTwin",icon:MessageCircle},
  {path:"/activity",label:"Activity",icon:Activity},
  {path:"/progress",label:"Progress",icon:TrendingUp},
  {path:"/settings",label:"Settings",icon:Settings2}
];

export function OrbitSecondaryWorkspace({pathname,children}:{
  pathname:string;children:ReactNode
}){
  const workspace=findOrbitSecondaryWorkspace(pathname);
  if(!workspace)return <>{children}</>;
  const Icon=workspace.icon;
  return <div className="orbit-lab orbit-secondary-workspace">
    <OrbitPreviewNav/>
    <div className="osw-container">
      <div className="osw-breadcrumb">
        <Link href="/orbit-beta"><Compass size={15}/> Orbit Today</Link>
        <span aria-hidden="true">/</span>
        <span>{workspace.name}</span>
      </div>
      <header className="osw-header">
        <div className="osw-header-copy">
          <div className="osw-eyebrow"><Icon size={16}/>{workspace.eyebrow}</div>
          <h1>{workspace.name}<span className="osw-star" aria-hidden="true">✦</span></h1>
          <p>{workspace.description}</p>
        </div>
        <div className="osw-header-mark" aria-hidden="true"><Icon size={30}/></div>
      </header>
      <nav className="osw-quick-nav" aria-label="Connected SkillTwin workspaces">
        {quickLinks.map(link=>{
          const QuickIcon=link.icon;
          const active=pathname===link.path||pathname.startsWith(link.path+"/");
          return <Link key={link.path} href={link.path} className={active?"is-current":""}
            aria-current={active?"page":undefined}>
            <QuickIcon size={15}/>{link.label}
          </Link>;
        })}
      </nav>
      <div className="osw-source-note">
        <span><ShieldCheck size={16}/> Connected to your saved SkillTwin data</span>
        <Link href="/orbit-beta">Back to Today <ArrowRight size={15}/></Link>
      </div>
      <section className="osw-content" aria-label={workspace.name+" workspace"}>
        {children}
      </section>
      <footer className="osw-footer">
        <span>SkillTwin Orbit · Evidence before assumptions</span>
        <Link href="/orbit-skills">Explore My Twin <ArrowRight size={14}/></Link>
      </footer>
    </div>
  </div>;
}
