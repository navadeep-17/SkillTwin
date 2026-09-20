export type DeploymentIdentity = {
  platform: "railway" | "local";
  commitSha: string | null;
  version: string;
  environment: string | null;
};

export function getDeploymentIdentity(): DeploymentIdentity {
  const commitSha = process.env.RAILWAY_GIT_COMMIT_SHA?.trim() || null;
  const environment = process.env.RAILWAY_ENVIRONMENT_NAME?.trim() || null;

  return {
    platform: commitSha ? "railway" : "local",
    commitSha,
    version: commitSha ? commitSha.slice(0, 8) : "local",
    environment
  };
}
