// Pure policy helper. The authenticated user ID comes ONLY from requireUser()
// in the server route, never from a user-supplied request parameter.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function sparksChargingAllowed(input:{
  globalFlag?:string;
  canaryIds?:string;
  userId?:string;
}):boolean {
  if(input.globalFlag==="true")return true;
  // Empty/malformed canary config cannot turn on spending.
  if(!input.userId||!UUID.test(input.userId))return false;
  return (input.canaryIds??"").split(",").map(x=>x.trim().toLowerCase())
    .filter(x=>UUID.test(x))
    .includes(input.userId.toLowerCase());
}
