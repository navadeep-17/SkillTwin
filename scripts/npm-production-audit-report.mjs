/** Privacy-safe, non-blocking summary of the npm production dependency audit.
 * Read only npm's JSON report. Never attempts package upgrades or exposes env.
 */
import {readFileSync} from "node:fs";

export function summarizeAudit(payload) {
  const issues=payload?.vulnerabilities;
  if (!issues || typeof issues!=="object" || Array.isArray(issues))
    return {status:"UNAVAILABLE",counts:{},packages:[]};
  const packages=Object.entries(issues).map(([name,v])=>({
    name,
    severity:String(v?.severity??"unknown"),
    direct: Boolean(v?.isDirect),
    range:typeof v?.range==="string"?v.range:"unknown",
    fixAvailable:typeof v?.fixAvailable==="boolean"?v.fixAvailable
      :v?.fixAvailable?.name&&v?.fixAvailable?.version
        ?String(v.fixAvailable.name)+"@"+String(v.fixAvailable.version)
        :"unknown",
    advisoryIds:Array.isArray(v?.via)
      ?v.via.filter(x=>typeof x==="object"&&Number.isInteger(x?.source))
        .map(x=>String(x.source)).slice(0,5):[]
  })).sort((a,b)=>
    ({critical:0,high:1,moderate:2,low:3}[a.severity]??4)-
    ({critical:0,high:1,moderate:2,low:3}[b.severity]??4)
  );
  return {
    status:"AUDIT_AVAILABLE",
    counts:payload?.metadata?.vulnerabilities??{},
    packages
  };
}
if(process.argv[1]?.endsWith("npm-production-audit-report.mjs")) {
  try {
    const audit=JSON.parse(readFileSync(process.argv[2],"utf8"));
    const report=summarizeAudit(audit);
    console.log("PRODUCTION_DEPENDENCY_AUDIT "+JSON.stringify(report));
    if(report.status!=="AUDIT_AVAILABLE")process.exitCode=2;
  }catch {
    console.error("PRODUCTION_DEPENDENCY_AUDIT_UNAVAILABLE: npm registry or report not accessible");
    process.exitCode=2;
  }
}
