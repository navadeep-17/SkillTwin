import type { LearnerLevel, LearningTaskType } from "./curated-learning-resources";

/**
 * LearnLens pilot: editor-reviewed lesson notes grounded in official PostgreSQL
 * documentation and creator-published YouTube chapters. No transcript is
 * downloaded, synthesized, stored or displayed.
 *
 * Lessons are practice aids, never verified evidence or assessment outcomes.
 * Video source: techTFQ / 0OQJDd3QqQM, creator chapter list published 2022-01-06.
 * Notes source: https://www.postgresql.org/docs/current/tutorial-join.html
 */
export type LessonQuestion = {
  id: string;
  prompt: string;
  options: Array<{ id: string; label: string }>;
  correctId: string;
  explanation: string;
};
export type LearnLensLesson = {
  id: string;
  title: string;
  skillSlug: "sql";
  level: "BASIC" | "STANDARD";
  objective: string;
  estimatedMinutes: number;
  video: {
    id: string;
    title: string;
    creator: string;
    url: string;
    chapters: Array<{ label: string; seconds: number }>;
    chaptersSource: "creator_description";
    transcriptAvailable: false;
  };
  studyNotes: Array<{ heading: string; explanation: string; example: string }>;
  reference: { title: string; url: string; publisher: string };
  questions: [LessonQuestion, LessonQuestion, LessonQuestion];
  exercise: { prompt: string; starter: string; sampleSolution: string; checklist: string[] };
};

const video = {
  id: "0OQJDd3QqQM",
  title: "SQL JOINS Tutorial for beginners | Practice SQL Queries using JOINS - Part 1",
  creator: "techTFQ",
  url: "https://www.youtube.com/watch?v=0OQJDd3QqQM",
  chapters: [
    {label:"Why joins matter",seconds:156},
    {label:"INNER JOIN",seconds:330},
    {label:"LEFT JOIN",seconds:835},
    {label:"RIGHT JOIN",seconds:1199}
  ],
  chaptersSource: "creator_description" as const,
  transcriptAvailable: false as const
};

const reference = {
  title: "Joins Between Tables",
  publisher: "PostgreSQL Documentation",
  url: "https://www.postgresql.org/docs/current/tutorial-join.html"
};

const questionsBasic: [LessonQuestion, LessonQuestion, LessonQuestion] = [
  {id:"inner",prompt:"Which join only returns matching rows from both tables?",options:[
    {id:"a",label:"LEFT JOIN"},{id:"b",label:"INNER JOIN"},{id:"c",label:"CROSS JOIN"}],
    correctId:"b",explanation:"INNER JOIN keeps row combinations satisfying the ON condition; unmatched left-side rows do not appear."},
  {id:"left",prompt:"An order has no matching customer. Which join preserves that order when orders is on the left?",options:[
    {id:"a",label:"LEFT JOIN"},{id:"b",label:"INNER JOIN"},{id:"c",label:"Neither"}],
    correctId:"a",explanation:"LEFT JOIN retains every order and fills columns from the unmatched customer row with NULL."},
  {id:"condition",prompt:"What is the role of ON in a JOIN query?",options:[
    {id:"a",label:"It specifies how rows are matched"},{id:"b",label:"It sorts the output"},{id:"c",label:"It creates a new table"}],
    correctId:"a",explanation:"The ON expression defines which rows from different tables correspond to each other."}
];

const questionsStandard: [LessonQuestion, LessonQuestion, LessonQuestion] = [
  {id:"nulls",prompt:"With customers LEFT JOIN orders, what appears for orders.id if a customer has no orders?",options:[
    {id:"a",label:"0"},{id:"b",label:"NULL"},{id:"c",label:"The customer id"}],
    correctId:"b",explanation:"Unmatched right-side columns are NULL, not zero. Check for missing matches with IS NULL."},
  {id:"filter",prompt:"How can you find customers who have never placed an order?",options:[
    {id:"a",label:"INNER JOIN orders"},{id:"b",label:"LEFT JOIN orders WHERE orders.id IS NULL"},{id:"c",label:"ORDER BY orders.id"}],
    correctId:"b",explanation:"Keep every customer using LEFT JOIN, then filter for unmatched right-side order IDs."},
  {id:"clarity",prompt:"Why qualify duplicated column names in a JOIN, e.g. customers.id?",options:[
    {id:"a",label:"To avoid ambiguity"},{id:"b",label:"To speed up every JOIN"},{id:"c",label:"To automatically index the table"}],
    correctId:"a",explanation:"Qualified names disambiguate columns; they do not automatically create indexes or guarantee faster execution."}
];

const sharedNotes = [
  {heading:"Think in relationships",explanation:"A JOIN relates rows from separate tables through a matching condition. Decide what relationship you want before writing SQL.",example:"FROM orders o JOIN customers c ON o.customer_id = c.id"},
  {heading:"INNER JOIN keeps matches",explanation:"When the ON condition fails to find a matching row, that left-side row is absent from an INNER JOIN result.",example:"SELECT o.id, c.name FROM orders o INNER JOIN customers c ON o.customer_id = c.id;"},
  {heading:"LEFT JOIN preserves the left side",explanation:"A LEFT JOIN retains all left-table rows. Columns from the right table are NULL when no matching row exists.",example:"SELECT c.name, o.id FROM customers c LEFT JOIN orders o ON c.id = o.customer_id;"}
];

const basic: LearnLensLesson = {
  id:"sql-joins-foundations-v1",skillSlug:"sql",level:"BASIC",
  title:"SQL JOINs: Understand the relationships",objective:"Learn to distinguish INNER and LEFT JOIN when combining related tables.",
  estimatedMinutes:25,video,reference,
  studyNotes:sharedNotes,
  questions:questionsBasic,
  exercise:{
    prompt:"You have customers(id, name) and orders(id, customer_id). Return each customer's name and any matching order ID, including customers who have not ordered yet.",
    starter:"SELECT c.name, o.id\nFROM customers c\n-- Write the join condition here",
    sampleSolution:"SELECT c.name, o.id\nFROM customers c\nLEFT JOIN orders o ON c.id = o.customer_id;",
    checklist:["Use customers as the left table","Use LEFT JOIN so unmatched customers are included","Match customers.id to orders.customer_id"]
  }
};
const standard: LearnLensLesson = {
  id:"sql-joins-applied-v1",skillSlug:"sql",level:"STANDARD",
  title:"SQL JOINs: Find missing relationships",objective:"Apply LEFT JOIN, qualified columns and NULL filtering to a practical backend query.",
  estimatedMinutes:30,video,reference,
  studyNotes:[
    sharedNotes[0],
    sharedNotes[2],
    {heading:"Find the unmatched rows",explanation:"After a LEFT JOIN, filtering on a right-table key IS NULL can identify left-side records without matches. Qualify names to keep complex joins understandable.",example:"SELECT c.id FROM customers c LEFT JOIN orders o ON c.id = o.customer_id WHERE o.id IS NULL;"}
  ],
  questions:questionsStandard,
  exercise:{
    prompt:"A backend reporting task needs names of customers who have never placed an order. Tables: customers(id, name), orders(id, customer_id). Write a query that returns only those customer names.",
    starter:"SELECT c.name\nFROM customers c\n-- Join orders and filter for customers with no orders",
    sampleSolution:"SELECT c.name\nFROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.id IS NULL;",
    checklist:["Preserve all customers with LEFT JOIN","Join on the actual foreign-key relationship","Check the right-table order ID for NULL"]
  }
};

/** Exact-match selection; never guesses a video from arbitrary user text. */
export function getLearnLensLesson(input: {
  skillSlug: string;
  taskType: LearningTaskType | string;
  difficulty: LearnerLevel | string;
}): LearnLensLesson | null {
  if (input.skillSlug !== "sql" || (input.taskType !== "LEARN" && input.taskType !== "PRACTICE")) return null;
  if (input.difficulty === "BASIC") return basic;
  if (input.difficulty === "STANDARD") return standard;
  return null;
}

/** Only a validated canonical YouTube ID and verified timestamp can be embedded. */
export function videoEmbedUrl(lesson: LearnLensLesson, startSeconds = 0): string {
  if (!/^[A-Za-z0-9_-]{11}$/.test(lesson.video.id)) throw new Error("INVALID_VIDEO_ID");
  const chapterSeconds = lesson.video.chapters.map(chapter => chapter.seconds);
  if (startSeconds !== 0 && !chapterSeconds.includes(startSeconds)) throw new Error("UNVERIFIED_TIMESTAMP");
  return "https://www.youtube-nocookie.com/embed/" + lesson.video.id + "?rel=0&start=" + startSeconds;
}
