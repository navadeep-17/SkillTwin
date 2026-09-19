import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root=process.cwd();
const dir=path.join(root,"supabase","migrations");
const files=(await readdir(dir))
  .filter(name=>/^\d{4}_.+\.sql$/.test(name))
  .sort();

if(!files.length) throw new Error("No migrations found.");

const numbers=files.map(name=>Number(name.slice(0,4)));
const unique=new Set(numbers);
if(unique.size!==numbers.length) throw new Error("Duplicate migration sequence number detected.");

for(let expected=1;expected<=numbers.at(-1);expected+=1){
  if(!unique.has(expected)) throw new Error("Missing migration "+String(expected).padStart(4,"0"));
}

const expectedHead=21;
if(numbers.at(-1)!==expectedHead){
  throw new Error("Migration head mismatch. Expected "+String(expectedHead).padStart(4,"0")+" but found "+String(numbers.at(-1)).padStart(4,"0"));
}

const seed=await readFile(path.join(root,"supabase","seed.sql"),"utf8");
for(const token of ["seed-2026-09-19-v2","resource-catalog-d2","adaptive-bank-e2"]){
  if(!seed.includes(token)) throw new Error("Seed is missing release token: "+token);
}

console.log(JSON.stringify({
  ok:true,
  migrationCount:files.length,
  migrationHead:files.at(-1),
  seedVersion:"seed-2026-09-19-v2"
},null,2));
