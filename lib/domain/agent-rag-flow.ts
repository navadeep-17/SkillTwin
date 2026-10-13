/**
 * Testable, read-only project-code retrieval workflow.
 * The caller must provide a list already scoped to the authenticated user;
 * this pure module never supplies identities, SQL, URLs or mutation tools.
 */
import {parsePublicGitHubRepo,type DefenseSnapshot} from "./project-defense.js";
import {
  selectSavedCodeProject,codeQuestionWithoutProjectName,retrieveProjectPassages,
  renderProjectRagResult,type RagHit
} from "./agent-rag.js";

export type SavedPublicCodeProject={id:string;title:string;artifact_url:string};
export type ProjectCodeRagResult={
  content:string;
  refs:Array<{type:"profile_project";id:string;label:string}>;
  meta:{
    generator:"source-rag-fallback-v1"|"source-rag-gemini-v1";
    readTools:string[];
  };
};
export type ProjectCodeRagDependencies={
  inspect:(repositoryUrl:string)=>Promise<Pick<DefenseSnapshot,"repository"|"commitSha"|"sources">>;
  synthesize:(question:string,hits:readonly RagHit[])=>Promise<string|null>;
};

const noRefs=()=>[] as ProjectCodeRagResult["refs"];
function result(
  content:string,refs:ProjectCodeRagResult["refs"]=noRefs(),
  generator:ProjectCodeRagResult["meta"]["generator"]="source-rag-fallback-v1"
):ProjectCodeRagResult{
  return {content,refs,meta:{generator,readTools:["get_project_code"]}};
}

export async function runProjectCodeRag(
  input:{question:string;projects:readonly SavedPublicCodeProject[]},
  dependencies:ProjectCodeRagDependencies
):Promise<ProjectCodeRagResult> {
  const eligible=input.projects.flatMap(project=>{
    const parsed=parsePublicGitHubRepo(project.artifact_url);
    return parsed?[{...project,repository:parsed.owner+"/"+parsed.repo}]:[];
  });
  const selection=selectSavedCodeProject(input.question,eligible);
  if(selection.status==="NONE")return result(
    "I could not find a saved public GitHub repository for your learner account. Add a project with a public github.com/owner/repository URL in Projects first."
  );
  if(selection.status==="UNSAVED")return result(
    "The specific GitHub repository named in your question is not one of your saved public projects. Save that repository in Projects before asking me to inspect its code."
  );
  if(selection.status==="AMBIGUOUS")return result(
    "You have multiple saved public GitHub projects. Mention the repository name or exact saved project title so I don't inspect the wrong code. Options: "+
    selection.titles.join(", ")+"."
  );

  const selected=eligible.find(project=>project.id===selection.project.id);
  if(!selected)throw new Error("INVALID_PROJECT_SELECTION");
  const refs=[{type:"profile_project" as const,id:selected.id,label:selected.title}];

  try{
    const snapshot=await dependencies.inspect(selected.artifact_url);
    if(snapshot.repository.toLowerCase()!==selected.repository.toLowerCase())
      return result("I cannot verify that the retrieved source belongs to your saved repository.",refs);
    const question=codeQuestionWithoutProjectName(input.question,selected.title,snapshot.repository);
    const hits=retrieveProjectPassages(question,snapshot.sources,2);
    // A failed or unsupported model response must never turn a valid source
    // retrieval into an invented explanation or obscure its pinned citations.
    let summary:string|null=null;
    if(hits.length){
      try{summary=await dependencies.synthesize(question,hits);}catch{summary=null;}
    }
    return result(
      renderProjectRagResult(snapshot.repository,snapshot.commitSha,hits,summary),
      refs,summary?"source-rag-gemini-v1":"source-rag-fallback-v1"
    );
  }catch{
    // No raw source, credentials, database errors or user content in logs.
    return result(
      "I could not safely retrieve verified public code for this saved project right now. GitHub may be unavailable, rate-limited, or the repository may not have enough supported source files. Try again later or open Project Defense.",
      refs
    );
  }
}
