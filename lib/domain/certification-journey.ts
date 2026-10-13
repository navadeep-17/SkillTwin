import { certificationById } from "./certification-catalog.js";

export const JOURNEY_STATUSES = [
  "SAVED","PREPARING","EXAM_PLANNED","EARNED_SELF_REPORTED"
] as const;
export type JourneyStatus=typeof JOURNEY_STATUSES[number];
export type CertificationJourney={
  id:string;
  certification_id:string;
  status:JourneyStatus;
  completed_topics:string[];
  target_exam_date:string|null;
  earned_date:string|null;
  credential_url:string|null;
  version:number;
  updated_at:string;
};
export type JourneyUpdate=
  | {action:"START_PREPARATION"}
  | {action:"TOGGLE_TOPIC";topic:string}
  | {action:"SET_EXAM_TARGET";targetExamDate:string}
  | {action:"REPORT_EARNED";earnedDate:string;credentialUrl?:string|null};

export type JourneyPatch={
  status:JourneyStatus;
  completed_topics:string[];
  target_exam_date:string|null;
  earned_date:string|null;
  credential_url:string|null;
};
const validDate=(s:string)=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
  const date=new Date(s+"T00:00:00Z");
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===s;
};
export class CertificationJourneyError extends Error {
  constructor(public code:"INVALID_CREDENTIAL"|"INVALID_DATE"|"INVALID_TRANSITION"|"INVALID_TOPIC"){
    super(code);
  }
}
function credentialUrl(raw:unknown):string|null{
  if(raw==null||raw==="")return null;
  if(typeof raw!=="string"||raw.length>1000)throw new CertificationJourneyError("INVALID_CREDENTIAL");
  let url:URL;
  try {url=new URL(raw)}catch {throw new CertificationJourneyError("INVALID_CREDENTIAL")}
  const privateHost=/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[?::1\]?|172\.(1[6-9]|2[0-9]|3[01])\.)/i;
  if(url.protocol!=="https:"||!url.hostname||url.username||url.password
    ||privateHost.test(url.hostname))throw new CertificationJourneyError("INVALID_CREDENTIAL");
  return url.href;
}
/**
 * User-controlled learning tracker only. No mutation of skill estimates,
 * learner evidence, verified credentials, or versioned roadmaps.
 */
export function planJourneyUpdate(
  row:CertificationJourney,change:JourneyUpdate,todayISO:string
):JourneyPatch {
  const certification=certificationById(row.certification_id);
  if(!certification)throw new CertificationJourneyError("INVALID_TRANSITION");
  const topics=Array.isArray(row.completed_topics)
    ?row.completed_topics.filter(t=>certification.topics.includes(t)):[];
  const base:JourneyPatch={
    status:row.status,completed_topics:topics,
    target_exam_date:row.target_exam_date,
    earned_date:row.earned_date,credential_url:row.credential_url
  };
  if(change.action==="START_PREPARATION"){
    if(!["SAVED","EXAM_PLANNED","PREPARING"].includes(row.status))
      throw new CertificationJourneyError("INVALID_TRANSITION");
    return {...base,status:"PREPARING",target_exam_date:null};
  }
  if(change.action==="TOGGLE_TOPIC"){
    if(!["PREPARING","EXAM_PLANNED"].includes(row.status))
      throw new CertificationJourneyError("INVALID_TRANSITION");
    if(!certification.topics.includes(change.topic))
      throw new CertificationJourneyError("INVALID_TOPIC");
    const set=new Set(topics);
    if(set.has(change.topic))set.delete(change.topic);else set.add(change.topic);
    return {...base,completed_topics:[...set]};
  }
  if(change.action==="SET_EXAM_TARGET"){
    if(row.status==="EARNED_SELF_REPORTED")
      throw new CertificationJourneyError("INVALID_TRANSITION");
    if(!validDate(change.targetExamDate)||!validDate(todayISO)
      ||change.targetExamDate<todayISO)
      throw new CertificationJourneyError("INVALID_DATE");
    return {...base,status:"EXAM_PLANNED",target_exam_date:change.targetExamDate};
  }
  if(change.action==="REPORT_EARNED"){
    if(!validDate(change.earnedDate)||!validDate(todayISO)
      ||change.earnedDate>todayISO)throw new CertificationJourneyError("INVALID_DATE");
    return {
      ...base,status:"EARNED_SELF_REPORTED",target_exam_date:null,
      earned_date:change.earnedDate,credential_url:credentialUrl(change.credentialUrl)
    };
  }
  throw new CertificationJourneyError("INVALID_TRANSITION");
}
export function progressPercent(row:Pick<CertificationJourney,"certification_id"|"completed_topics">):number{
  const cert=certificationById(row.certification_id);
  if(!cert||!cert.topics.length)return 0;
  const topics=new Set(Array.isArray(row.completed_topics)?row.completed_topics:[]);
  return Math.round(cert.topics.filter(t=>topics.has(t)).length/cert.topics.length*100);
}
