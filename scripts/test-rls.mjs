import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

if(process.env.ALLOW_RLS_TESTS!=="true"){
  throw new Error("Refusing to run cross-user RLS tests without ALLOW_RLS_TESTS=true.");
}

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url || !anon || !service){
  throw new Error("RLS test requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.");
}

const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});
const suffix=Date.now()+"-"+Math.random().toString(36).slice(2,8);
const password="SkillTwin-RLS-"+randomUUID()+"!";
const emailA="skilltwin-rls-a-"+suffix+"@example.com";
const emailB="skilltwin-rls-b-"+suffix+"@example.com";
let userA=null,userB=null,roleId=null,storagePath=null;

function client(){
  return createClient(url,anon,{auth:{autoRefreshToken:false,persistSession:false}});
}
function assert(condition,message){
  if(!condition) throw new Error(message);
}

try{
  const createdA=await admin.auth.admin.createUser({email:emailA,password,email_confirm:true,user_metadata:{display_name:"RLS A"}});
  if(createdA.error) throw createdA.error;
  userA=createdA.data.user;

  const createdB=await admin.auth.admin.createUser({email:emailB,password,email_confirm:true,user_metadata:{display_name:"RLS B"}});
  if(createdB.error) throw createdB.error;
  userB=createdB.data.user;

  const a=client(),b=client();
  const signA=await a.auth.signInWithPassword({email:emailA,password});
  const signB=await b.auth.signInWithPassword({email:emailB,password});
  if(signA.error) throw signA.error;
  if(signB.error) throw signB.error;

  const upsertA=await a.from("user_learning_settings").upsert({user_id:userA.id,notifications_enabled:true,weekly_report_enabled:true,reduced_motion:false,compact_density:false});
  if(upsertA.error) throw upsertA.error;
  const upsertB=await b.from("user_learning_settings").upsert({user_id:userB.id,notifications_enabled:true,weekly_report_enabled:true,reduced_motion:false,compact_density:false});
  if(upsertB.error) throw upsertB.error;

  const crossRead=await b.from("user_learning_settings").select("user_id").eq("user_id",userA.id);
  if(crossRead.error) throw crossRead.error;
  assert((crossRead.data ?? []).length===0,"User B could read User A learner settings.");

  const crossWrite=await b.from("user_learning_settings").upsert({
    user_id:userA.id,notifications_enabled:false,weekly_report_enabled:false,reduced_motion:true,compact_density:true
  });
  assert(Boolean(crossWrite.error),"User B cross-user write unexpectedly succeeded.");

  roleId=randomUUID();
  const roleVersionId=randomUUID();
  const roleInsert=await admin.from("target_roles").insert({
    id:roleId,slug:"rls-private-"+suffix,name:"RLS Private Role",family:"Test",owner_user_id:userA.id
  });
  if(roleInsert.error) throw roleInsert.error;
  const versionInsert=await admin.from("role_versions").insert({
    id:roleVersionId,role_id:roleId,version:1,source:"AI_GENERATED",status:"ACTIVE",schema_version:"role-c1"
  });
  if(versionInsert.error) throw versionInsert.error;

  const aRole=await a.from("target_roles").select("id").eq("id",roleId);
  if(aRole.error) throw aRole.error;
  assert((aRole.data ?? []).length===1,"Owner could not read owned custom role.");

  const bRole=await b.from("target_roles").select("id").eq("id",roleId);
  if(bRole.error) throw bRole.error;
  assert((bRole.data ?? []).length===0,"Non-owner could read another learner's custom role.");

  const bVersion=await b.from("role_versions").select("id").eq("id",roleVersionId);
  if(bVersion.error) throw bVersion.error;
  assert((bVersion.data ?? []).length===0,"Non-owner could read another learner's custom role version.");

  storagePath=userA.id+"/rls-"+suffix+".pdf";
  const upload=await admin.storage.from("profile-documents").upload(
    storagePath,
    new Blob([new Uint8Array([37,80,68,70,45,49,46,52])],{type:"application/pdf"}),
    {contentType:"application/pdf",upsert:false}
  );
  if(upload.error) throw upload.error;

  const ownerDownload=await a.storage.from("profile-documents").download(storagePath);
  if(ownerDownload.error) throw ownerDownload.error;

  const crossDownload=await b.storage.from("profile-documents").download(storagePath);
  assert(Boolean(crossDownload.error),"Non-owner could download another learner's private profile document.");

  console.log(JSON.stringify({
    ok:true,
    rowIsolation:true,
    crossUserWriteBlocked:true,
    customRoleIsolation:true,
    privateStorageIsolation:true
  },null,2));
}finally{
  if(storagePath) await admin.storage.from("profile-documents").remove([storagePath]).catch(()=>{});
  if(roleId) await admin.from("target_roles").delete().eq("id",roleId).catch(()=>{});
  if(userA?.id) await admin.auth.admin.deleteUser(userA.id).catch(()=>{});
  if(userB?.id) await admin.auth.admin.deleteUser(userB.id).catch(()=>{});
}
