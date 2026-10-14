# SkillTwin Roadmap video resource upgrade — implementation plan

## Objective

Provide **high-value, focused external video chapters** as *supplemental* learning
material inside the classic white-and-blue **Plan → Roadmap** task cards.
Keep the existing documentation, interactive exercise, task ownership and
LearnLens guided-lesson flows. The product must not claim watching a video
provides assessment evidence, a validated skill level or automatic completion.

## Delivery phases

| Stage | Work | Validation |
|---|---|---|
| 1. Editor-reviewed catalog | 16 topic starts across 9 exact skill slugs; titles, creators, timestamps, review dates, references | Static safe YouTube URLs, checked creator descriptions and existing LearnLens chapters |
| 2. Matching | Filter by exact skill, difficulty and task type; do not suggest unrelated video chapters for explicit specialist topics | No mismatched SQL-indexing video, no advanced beginner video, no BUILD/VALIDATE auto-watch |
| 3. Roadmap presentation | Show Watch, Read and Practice together, with topic, creator, study block, original outbound URL and optional LearnLens | Keyboard-accessible links, mobile wrapping, no embedded auto-load |
| 4. QA and release | Unit tests, TypeScript, build, CI and review before merge | Read-only recommendations, no schema migration, no user-data writes |
| 5. Maintenance | Quarterly video availability/identity/topic review, retire broken links, expand reviewed chapters | No transcript scraping or AI-invented citations |

## Curated video choices and provenance

The code-owned list lives in `lib/domain/editor-reviewed-videos.ts`. Video
start times refer to published *chapters or selected topical offsets*, not
independent full-course runtimes. Suggested study minutes describe *how long to
spend on the focused section*, not the duration of the complete source video.

- **SQL** — techTFQ, [SQL JOINs](https://www.youtube.com/watch?v=0OQJDd3QqQM).
  Beginner JOIN purpose 02:36; applied LEFT JOIN 13:55; background:
  [PostgreSQL JOIN tutorial](https://www.postgresql.org/docs/current/tutorial-join.html).
- **Python** — Programming with Mosh, [Python Full Course](https://www.youtube.com/watch?v=K5KVEU3aaeQ).
  Variables 31:44; defining functions 1:45:13; companion:
  [Python 3 tutorial](https://docs.python.org/3/tutorial/).
- **Git** — Traversy Media, [Git & GitHub Crash Course](https://www.youtube.com/watch?v=vA5TTz6BXhY).
  Staging 16:30; branches 39:00; companion:
  [Pro Git](https://git-scm.com/book/en/v2/Git-Basics-Recording-Changes-to-the-Repository).
- **Docker** — mCoding, [Docker Tutorial for Beginners](https://www.youtube.com/watch?v=b0HMimUb4f0).
  Images/containers 07:17; Compose 36:39; companion:
  [Docker Docs](https://docs.docker.com/get-started/).
- **Java** — Bro Code, [Start coding with Java in 10 minutes](https://www.youtube.com/watch?v=23HFxAPyJ9U);
  introductory setup/first program only, with [dev.java](https://dev.java/learn/).
- **JavaScript** — Bro Code, [JavaScript Full Course](https://www.youtube.com/watch?v=lfmg-EJ8gm4):
  variables at 12:32, functions at 2:49:31; companion:
  [MDN JavaScript Guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide).
- **Node.js** — Traversy Media, [Node.js Crash Course](https://www.youtube.com/watch?v=32M1al-Y6Ag):
  setup at 15:19, HTTP module at 27:20; companion:
  [Node.js](https://nodejs.org/learn/getting-started/introduction-to-nodejs).
- **Linux** — Keep On Coding, [Linux Command Line for Beginners](https://www.youtube.com/watch?v=16d2lHc0Pe8):
  navigation at 03:07, pipelines at 45:12; companion:
  [Ubuntu Command Line](https://ubuntu.com/tutorials/command-line-for-beginners).
- **System design** — ByteByteGo, [System Design Interview: A Step-By-Step Guide](https://www.youtube.com/watch?v=i7twT3x5yv8);
  a structured interview overview for STANDARD-level LEARN tasks only.

## Editorial safeguards

- Catalog video IDs are fixed, 11-character YouTube IDs and HTTPS watch links
  are created by SkillTwin. Never interpolate an untrusted learner-provided URL.
- No video is recommended for BUILD or VALIDATE tasks. No evidence or skill
  measurements are written by visiting resource links.
- Only recommend videos for their tagged level and mode. A narrow topic like
  SQL indexing or Dockerfiles does *not* receive an unrelated JOIN/Compose
  chapter solely because the skill matches.
- A focused video never displaces a matching documentation/practice link:
  up to 2 existing resources **plus** 1 video per task.
- Task duration determines the suggested study block; it never pretends to be
  the complete runtime of a long video.
- Link titles and creator names are attribution, not endorsements or
  certification of the learner. No unauthorized transcript/caption ingestion.
- If video links become unavailable or change topic, remove the item from the
  reviewed catalog and let non-video recommendations remain usable.

## Out of scope

Universal video search, dynamic YouTube API integration, playlist enrollment,
copyrighted transcript reproduction, automatic video completion tracking,
AI-generated video summaries, background transcript processing, or assessment
score modification. These require a separately reviewed design.
