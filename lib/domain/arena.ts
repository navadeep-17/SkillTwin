import {z} from "zod";

export const ARENA_TOPICS=["python","sql","javascript"] as const;
export const arenaTopicSchema=z.enum(ARENA_TOPICS);
export type ArenaTopic=z.infer<typeof arenaTopicSchema>;
export const ARENA_LABELS:Record<ArenaTopic,string>={
  python:"Python",sql:"SQL",javascript:"JavaScript"
};
const matchId=z.string().uuid();
const common=z.object({topic:arenaTopicSchema});
const idle=z.object({status:z.literal("IDLE")});
const waiting=common.extend({status:z.literal("WAITING")});
const playing=common.extend({
  status:z.literal("PLAYING"),matchId,
  questionNumber:z.number().int().min(1).max(5),
  totalQuestions:z.literal(5),
  question:z.string().min(1),
  options:z.array(z.string()).length(4),
  answered:z.boolean(),rivalAnswered:z.boolean(),
  secondsRemaining:z.number().int().min(0).max(30)
});
const finished=common.extend({
  status:z.literal("FINISHED"),matchId,totalQuestions:z.literal(5),
  myScore:z.number().int().min(0).max(5),
  rivalScore:z.number().int().min(0).max(5),
  outcome:z.enum(["WIN","LOSS","TIE"])
});
export const arenaStateSchema=z.discriminatedUnion("status",[
  idle,waiting,playing,finished
]);
export type ArenaState=z.infer<typeof arenaStateSchema>;

export function parseArenaState(raw:unknown):ArenaState {
  return arenaStateSchema.parse(raw);
}

/** We don't relay database details to a browser. */
export function arenaApiError(error:unknown):{status:number;code:string;message:string} {
  const msg=error&&typeof error==="object"&&"message" in error
    ?String(error.message):"";
  if(msg.includes("ARENA_INVALID_TOPIC"))
    return {status:400,code:"ARENA_INVALID_TOPIC",message:"Choose a supported Arena topic."};
  if(msg.includes("ARENA_INVALID_ANSWER"))
    return {status:400,code:"ARENA_INVALID_ANSWER",message:"Invalid quiz answer."};
  if(msg.includes("ARENA_QUESTION_CLOSED"))
    return {status:409,code:"ARENA_QUESTION_CLOSED",message:"This question has closed. Wait for the next one."};
  if(msg.includes("ARENA_MATCH_NOT_FOUND")||msg.includes("ARENA_MATCH_INACTIVE"))
    return {status:404,code:"ARENA_MATCH_NOT_FOUND",message:"This match is unavailable to your account."};
  return {status:503,code:"ARENA_UNAVAILABLE",
    message:"Arena is temporarily unavailable. Please try again."};
}
