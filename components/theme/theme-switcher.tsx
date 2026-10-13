"use client";

import {useEffect, useState} from "react";
import {Moon, Monitor, Sun} from "lucide-react";
import "./theme-switcher.css";

type Choice = "light" | "dark" | "system";
const choices: {value:Choice;label:string;icon:typeof Sun}[] = [
  {value:"light",label:"Light",icon:Sun},
  {value:"dark",label:"Dark",icon:Moon},
  {value:"system",label:"System",icon:Monitor}
];
const storageKey = "skilltwin-theme";

function getChoice():Choice {
  if(typeof document==="undefined")return "system";
  const preference=document.documentElement.dataset.themePreference;
  return preference==="light"||preference==="dark"||preference==="system"?preference:"system";
}
function setChoice(next:Choice){
  try{window.localStorage.setItem(storageKey,next);}catch{/* Private browsing can disallow storage. */}
  const dark=window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.themePreference=next;
  document.documentElement.dataset.theme=next==="system"?(dark?"dark":"light"):next;
  window.dispatchEvent(new Event("skilltwin-theme-change"));
}

/** A compact native select for headers or an explicit accessible choice in Settings. */
export function ThemeSwitcher({compact=false}:{compact?:boolean}){
  const [choice,setState]=useState<Choice>("system");
  useEffect(()=>{
    const sync=()=>setState(getChoice());
    sync();
    window.addEventListener("skilltwin-theme-change",sync);
    window.addEventListener("storage",sync);
    return ()=>{
      window.removeEventListener("skilltwin-theme-change",sync);
      window.removeEventListener("storage",sync);
    };
  },[]);
  const choose=(value:Choice)=>{setChoice(value);setState(value);};

  if(compact)return <label className="st-theme-compact">
    <span className="st-theme-compact-label">Appearance</span>
    <select aria-label="Appearance theme" value={choice}
      onChange={event=>choose(event.target.value as Choice)}>
      {choices.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}
    </select>
  </label>;

  return <section className="st-theme-panel" aria-labelledby="st-appearance-label">
    <div className="st-theme-heading">
      <span className="st-theme-overline">DISPLAY PREFERENCES</span>
      <h2 id="st-appearance-label">Appearance</h2>
      <p>Choose how SkillTwin looks. System follows your device. Your choice is saved in this browser.</p>
    </div>
    <div className="st-theme-choices" role="group" aria-label="Appearance preference">
      {choices.map(item=>{
        const Icon=item.icon;
        return <button key={item.value} type="button"
          className={"st-theme-choice"+(choice===item.value?" selected":"")}
          aria-pressed={choice===item.value} onClick={()=>choose(item.value)}>
          <Icon size={20} aria-hidden="true"/>
          <span>{item.label}</span>
          <small>{item.value==="light"?"Bright surfaces":item.value==="dark"?"Low-glare surfaces":"Follow device"}</small>
        </button>;
      })}
    </div>
    <p className="st-theme-feedback" role="status">{choice==="system"?"Using your device's appearance setting.":"Using "+(choice==="dark"?"dark":"light")+" appearance."} Changes apply immediately.</p>
  </section>;
}
