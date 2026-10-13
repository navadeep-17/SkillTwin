/**
 * Orbit default is a server-side deployment decision, not a value baked
 * into browser JavaScript at build time. Railway may inject variables into
 * the running container after Next.js has built its client bundle.
 *
 * Keep compatibility with the existing production variable while allowing
 * the unprefixed, server-only setting in future environments.
 */
export function isOrbitDefaultEnabled(): boolean {
  const existingName = ["NEXT_PUBLIC", "SKILLTWIN", "ORBIT", "DEFAULT"].join("_");
  const serverName = ["SKILLTWIN", "ORBIT", "DEFAULT"].join("_");
  return (process.env[serverName] ?? process.env[existingName]) === "true";
}
