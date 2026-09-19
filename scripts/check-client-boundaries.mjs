import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root=process.cwd();
const roots=["app","components"];
const forbidden=[
  "@/lib/db/",
  "@/lib/config/env",
  "server-only",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_DB_URL",
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
  "DEMO_RESET_SECRET"
];

async function walk(dir){
  const entries=await readdir(dir,{withFileTypes:true});
  const out=[];
  for(const entry of entries){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()) out.push(...await walk(full));
    else if(/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const violations=[];
for(const rootName of roots){
  const base=path.join(root,rootName);
  for(const file of await walk(base)){
    const source=await readFile(file,"utf8");
    const trimmed=source.trimStart();
    if(!trimmed.startsWith('"use client"') && !trimmed.startsWith("'use client'")) continue;
    for(const token of forbidden){
      if(source.includes(token)) violations.push({file:path.relative(root,file),token});
    }
    if(/process\.env\.(?!NEXT_PUBLIC_)/.test(source)){
      violations.push({file:path.relative(root,file),token:"non-public process.env"});
    }
  }
}
if(violations.length){
  console.error(JSON.stringify({ok:false,violations},null,2));
  process.exit(1);
}
console.log(JSON.stringify({ok:true,checked:"client server-boundary imports"},null,2));
