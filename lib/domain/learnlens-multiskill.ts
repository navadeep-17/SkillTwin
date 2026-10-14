import type { LearnLensLesson, LessonQuestion } from "./learnlens-lessons.js";

/**
 * Small reviewed expansion: creator-published chapter timestamps, with original
 * SkillTwin explanations based on the separately cited official documentation.
 * Not a video transcript and not an automated transcript summarizer.
 */
type Entry = Omit<LearnLensLesson, "video" | "reference"> & {
  video: LearnLensLesson["video"]; reference: LearnLensLesson["reference"];
};
type Chapter = {label: string; seconds: number};

const pythonVideo = {
  id: "K5KVEU3aaeQ",
  title: "Python Full Course for Beginners",
  creator: "Programming with Mosh",
  url: "https://www.youtube.com/watch?v=K5KVEU3aaeQ",
  chaptersSource: "creator_description" as const,
  transcriptAvailable: false as const
};
const gitVideo = {
  id: "vA5TTz6BXhY",
  title: "Git & GitHub Crash Course 2025",
  creator: "Traversy Media",
  url: "https://www.youtube.com/watch?v=vA5TTz6BXhY",
  chaptersSource: "creator_description" as const,
  transcriptAvailable: false as const
};
const dockerVideo = {
  id: "b0HMimUb4f0",
  title: "Docker Tutorial for Beginners",
  creator: "mCoding",
  url: "https://www.youtube.com/watch?v=b0HMimUb4f0",
  chaptersSource: "creator_description" as const,
  transcriptAvailable: false as const
};

function withChapters(
  video: typeof pythonVideo,
  chapters: Chapter[]
): LearnLensLesson["video"] {return {...video,chapters};}

const pythonReference = {title:"Python 3 Tutorial",publisher:"Python Documentation",url:"https://docs.python.org/3/tutorial/"};
const gitReference = {title:"Pro Git: Recording Changes",publisher:"Git Documentation",url:"https://git-scm.com/book/en/v2/Git-Basics-Recording-Changes-to-the-Repository"};
const dockerReference = {title:"Get started with Docker",publisher:"Docker Documentation",url:"https://docs.docker.com/get-started/"};

function q(id:string,prompt:string,options:[string,string,string],correctIndex:0|1|2,explanation:string):LessonQuestion {
  return {id,prompt,options:options.map((label,i)=>({id:String(i),label})),correctId:String(correctIndex),explanation};
}
function lesson(input: {
  id:string;title:string;slug:"python"|"git"|"docker";level:"BASIC"|"STANDARD";objective:string;minutes:number;
  video:LearnLensLesson["video"];reference:LearnLensLesson["reference"];
  notes:LearnLensLesson["studyNotes"];questions:[LessonQuestion,LessonQuestion,LessonQuestion];
  exercise:LearnLensLesson["exercise"];
}):LearnLensLesson {
  return {id:input.id,skillSlug:input.slug,level:input.level,title:input.title,objective:input.objective,
    estimatedMinutes:input.minutes,video:input.video,reference:input.reference,
    studyNotes:input.notes,questions:input.questions,exercise:input.exercise};
}

const pythonBasic = lesson({
  id:"python-control-flow-foundations-v1",slug:"python",level:"BASIC",
  title:"Python: Variables, conditions and loops",objective:"Read and write short Python programs that store values and branch or iterate correctly.",minutes:25,
  video:withChapters(pythonVideo,[
    {label:"Variables",seconds:31*60+44},{label:"Conditional statements",seconds:68*60+46},
    {label:"For loops",seconds:84*60+18},{label:"While loops",seconds:96*60+34}]),
  reference:pythonReference,
  notes:[
    {heading:"Store and update values",explanation:"Names refer to objects. Assign a value with = and inspect it using print.",example:"tasks = 3\nprint(tasks)"},
    {heading:"Choose a branch",explanation:"if and else execute different indented blocks depending on a condition.",example:"if tasks > 0:\n    print('Start')\nelse:\n    print('Rest')"},
    {heading:"Repeat safely",explanation:"A for loop iterates over a sequence; range(n) produces integers from 0 through n-1.",example:"for day in range(3):\n    print(day)"}
  ],
  questions:[
    q("py-assign","What does the = operator do in tasks = 3?",["Compares two objects","Assigns a value to a name","Creates a loop"],1,"Assignment binds the name tasks to the integer value 3."),
    q("py-condition","Which keyword starts a conditional branch?",["if","for","def"],0,"Use if for branching when a condition evaluates as true."),
    q("py-range","What does range(3) yield in a for loop?",["1,2,3","0,1,2,3","0,1,2"],2,"range(3) stops before 3.")
  ],
  exercise:{
    prompt:"Given daily_minutes = [15, 0, 30], write a loop that prints 'Study' for positive entries and 'Skip' otherwise.",
    starter:"daily_minutes = [15, 0, 30]\n# Add a loop and a condition",
    sampleSolution:"daily_minutes = [15, 0, 30]\nfor minutes in daily_minutes:\n    if minutes > 0:\n        print('Study')\n    else:\n        print('Skip')",
    checklist:["Iterate over the list","Check whether each value is positive","Print the correct message for each entry"]
  }
});
const pythonStandard = lesson({
  id:"python-function-refactor-v1",slug:"python",level:"STANDARD",
  title:"Python: Reusable functions and arguments",objective:"Extract a reusable function from repeated backend or data-processing logic.",minutes:30,
  video:withChapters(pythonVideo,[
    {label:"Defining functions",seconds:105*60+13},{label:"Function arguments",seconds:107*60+37},
    {label:"Keyword arguments",seconds:113*60+59},{label:"Default arguments",seconds:115*60+59}]),
  reference:{title:"Defining Functions",publisher:"Python Documentation",url:"https://docs.python.org/3/tutorial/controlflow.html#defining-functions"},
  notes:[
    {heading:"Define behavior once",explanation:"A def statement creates a function; its body runs when called.",example:"def double(value):\n    return value * 2"},
    {heading:"Pass data as arguments",explanation:"Parameters accept input values from the caller. A return statement produces the result.",example:"result = double(12)\nprint(result)"},
    {heading:"Use defaults deliberately",explanation:"Default parameter values allow optional arguments, but avoid mutable defaults for shared state.",example:"def greeting(name, prefix='Hi'):\n    return f'{prefix} {name}'"}
  ],
  questions:[
    q("py-return","What does return do?",["Stops all Python programs","Produces a function's result","Prints to the console"],1,"return sends a value to the caller and exits the function."),
    q("py-argument","In double(12), what is 12?",["An argument","A function definition","An exception"],0,"12 is passed to the function's parameter."),
    q("py-default","What happens if a function's optional argument is omitted?",["A default is used","It always crashes","The function becomes async"],0,"The default parameter value is used when that argument isn't provided.")
  ],
  exercise:{
    prompt:"Refactor the repeated calculation into a function total_cost(price, quantity=1) and call it for two orders.",
    starter:"# Define total_cost(price, quantity=1)\n# Return price * quantity",
    sampleSolution:"def total_cost(price, quantity=1):\n    return price * quantity\n\nprint(total_cost(50, 2))\nprint(total_cost(30))",
    checklist:["Define a function","Accept a quantity argument with a default","Return the computed total and call it twice"]
  }
});
const gitBasic=lesson({
  id:"git-local-workflow-v1",slug:"git",level:"BASIC",
  title:"Git: From working tree to commit",objective:"Create a repository, inspect changes, stage files and record a focused commit.",minutes:25,
  video:withChapters(gitVideo,[
    {label:"Workflow overview",seconds:7*60+36},{label:"Initialize repository",seconds:14*60+49},
    {label:"Stage changes",seconds:16*60+30},{label:"Commit changes",seconds:17*60+25}]),
  reference:gitReference,
  notes:[
    {heading:"Git tracks versions",explanation:"Git maintains snapshots in a repository, letting you review and recover changes.",example:"git init\ngit status"},
    {heading:"Stage intentionally",explanation:"git add puts selected changes into the index; unstaged edits aren't part of the next commit.",example:"git add README.md\ngit diff --cached"},
    {heading:"Commit a coherent change",explanation:"git commit creates a local snapshot of staged content with a description.",example:"git commit -m 'docs: add setup steps'"}
  ],
  questions:[
    q("git-status","Which command shows staged and unstaged changes?",["git status","git push","git clone"],0,"git status summarizes repository working tree and index state."),
    q("git-add","What does git add do?",["Uploads to GitHub","Stages files for commit","Deletes untracked files"],1,"git add stages content locally."),
    q("git-commit","Where is a new commit stored initially?",["Only on GitHub","In the local Git repository","In a Docker image"],1,"A local git commit does not require a network connection.")
  ],
  exercise:{
    prompt:"Write the Git commands to initialize a new project, stage README.md, then commit a setup message.",
    starter:"# Initialize\n# Stage README.md\n# Commit",
    sampleSolution:"git init\ngit add README.md\ngit commit -m 'docs: project setup'",
    checklist:["Initialize the local repository","Stage the intended file","Commit with a descriptive message"]
  }
});
const gitStandard=lesson({
  id:"git-branch-pr-workflow-v1",slug:"git",level:"STANDARD",
  title:"Git: Branches and pull requests",objective:"Develop changes on a branch and explain how to merge them safely through review.",minutes:30,
  video:withChapters(gitVideo,[
    {label:"Clone a repository",seconds:38*60},{label:"Branching",seconds:39*60},
    {label:"Pull requests",seconds:42*60+14},{label:"Merging",seconds:45*60+9}]),
  reference:{title:"Git Branching — Branches in a Nutshell",publisher:"Git Documentation",url:"https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell"},
  notes:[
    {heading:"Branches isolate change",explanation:"A branch is a movable pointer to a commit. Create a topic branch for an isolated change.",example:"git switch -c feat/login-validation"},
    {heading:"Push and review",explanation:"A remote branch can be proposed for code review via a GitHub pull request.",example:"git push -u origin feat/login-validation"},
    {heading:"Merge after validation",explanation:"Review conflicts and test results before bringing a feature branch into the target branch.",example:"git switch main\ngit pull\ngit merge feat/login-validation"}
  ],
  questions:[
    q("branch","What is the key purpose of a feature branch?",["Separate work from main","Encrypt the code","Run production builds"],0,"Topic branches isolate development work."),
    q("pr","What does a pull request primarily support?",["Proposing and reviewing changes","Deleting Git history","Replacing a local commit"],0,"Pull requests let others inspect and discuss changes before merging."),
    q("merge","What should happen before merging into main?",["Review and test","Delete the remote repository","Always force push"],0,"Review and CI reduce the risk of shipping broken changes.")
  ],
  exercise:{
    prompt:"Draft the commands to create feat/docs, commit documentation, and push the branch to origin.",
    starter:"# Switch to a new branch\n# Stage documentation\n# Commit and push",
    sampleSolution:"git switch -c feat/docs\ngit add README.md\ngit commit -m 'docs: improve readme'\ngit push -u origin feat/docs",
    checklist:["Create a topic branch","Make a focused commit","Publish the branch for review"]
  }
});
const dockerBasic=lesson({
  id:"docker-image-container-v1",slug:"docker",level:"BASIC",
  title:"Docker: Images, containers and ports",objective:"Explain container/image differences and run a local service with published ports.",minutes:25,
  video:withChapters(dockerVideo,[
    {label:"What Docker solves",seconds:84},{label:"Containers vs VMs",seconds:201},
    {label:"Containers vs images",seconds:437},{label:"Port mapping",seconds:515}]),
  reference:dockerReference,
  notes:[
    {heading:"Images are templates",explanation:"A Docker image packages application contents; a container is a runnable instance created from that image.",example:"docker image ls\ndocker ps"},
    {heading:"Run a container",explanation:"docker run creates and starts a container from an image.",example:"docker run --rm hello-world"},
    {heading:"Publish a port",explanation:"-p maps a host port to a container port so a service can be accessed from outside the container.",example:"docker run --rm -p 8080:80 nginx"}
  ],
  questions:[
    q("docker-image","What is a Docker image?",["A running process","A template for containers","A VM hypervisor"],1,"An image is the runnable package; a container is its instance."),
    q("docker-run","What does docker run do?",["Builds only","Creates and starts a container","Deletes all volumes"],1,"docker run starts a new container from an image."),
    q("docker-port","What does -p 8080:80 mean?",["Host 8080 to container 80","Host 80 to container 8080","A CPU limit"],0,"The left port is the host; the right port is inside the container.")
  ],
  exercise:{
    prompt:"Write the command to run nginx on host port 8080 and remove the container when it stops.",
    starter:"# Use docker run with --rm and -p",
    sampleSolution:"docker run --rm -p 8080:80 nginx",
    checklist:["Use the nginx image","Publish host 8080 to container 80","Include --rm"]
  }
});
const dockerStandard=lesson({
  id:"docker-build-compose-v1",slug:"docker",level:"STANDARD",
  title:"Docker: Build an image and run a stack",objective:"Explain Dockerfiles, layers and Compose when shipping a small backend service.",minutes:30,
  video:withChapters(dockerVideo,[
    {label:"Custom images and Dockerfiles",seconds:22*60+25},
    {label:"Docker image layers",seconds:26*60+6},
    {label:"Multi-stage builds",seconds:33*60+40},
    {label:"Docker Compose",seconds:36*60+39}]),
  reference:{title:"Docker Workshop",publisher:"Docker Documentation",url:"https://docs.docker.com/get-started/workshop/"},
  notes:[
    {heading:"Declare an image recipe",explanation:"A Dockerfile describes instructions used to build a reproducible application image.",example:"FROM node:22-alpine\nWORKDIR /app\nCOPY . ."},
    {heading:"Build and tag",explanation:"docker build executes instructions and stores build layers to improve subsequent rebuilds.",example:"docker build -t my-api:dev ."},
    {heading:"Run related services",explanation:"Compose defines multiple services in a YAML configuration and runs them together.",example:"docker compose up --build"}
  ],
  questions:[
    q("dockerfile","What does a Dockerfile define?",["An image build recipe","Git branch names","Only port forwards"],0,"A Dockerfile declares instructions for building an image."),
    q("layers","Why organize Dockerfile layers carefully?",["To avoid any testing","To improve caching and builds","To disable isolation"],1,"Build cache can reuse unchanged layers."),
    q("compose","What does Docker Compose help run?",["Multiple related services","Only one HTTP request","A Git pull request"],0,"Compose manages application stacks declared in YAML.")
  ],
  exercise:{
    prompt:"Draft the commands to build a Dockerfile as my-api:dev and launch an existing Compose stack.",
    starter:"# Build a tagged image\n# Start the Compose services",
    sampleSolution:"docker build -t my-api:dev .\ndocker compose up --build",
    checklist:["Build using the current directory","Tag the image","Start the Compose services"]
  }
});

export const EXTENDED_LEARNLENS_LESSONS: readonly LearnLensLesson[] = [
  pythonBasic,pythonStandard,gitBasic,gitStandard,dockerBasic,dockerStandard
];

export function getExtendedLearnLensLesson(input:{
  skillSlug:string;taskType:string;difficulty:string;
}):LearnLensLesson|null {
  if(input.taskType!=="LEARN" && input.taskType!=="PRACTICE")return null;
  return EXTENDED_LEARNLENS_LESSONS.find(x=>x.skillSlug===input.skillSlug && x.level===input.difficulty)??null;
}
