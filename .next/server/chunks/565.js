"use strict";exports.id=565,exports.ids=[565],exports.modules={94565:(a,b,c)=>{c.d(b,{startLocalScheduler:()=>W});let d={mayor:{name:"Mayor",place:"Town Hall",color:"#1F3A36",blurb:"Takes any request and sends it to the right agent.",prompt:"You are the Mayor of Agent City, which manages the user's files. You do not edit files yourself. Pick the right agent with the delegate tool (librarian: loose files and organizing, professor: course notes and study material, builder: code projects, planner: tasks, deadlines, schedules). Split big requests into several delegations. Then summarize what happened in a few sentences."},librarian:{name:"Librarian",place:"Library",color:"#D9972B",blurb:"Sorts and renames files, keeps the Library folder tidy.",prompt:"You are the Librarian. You own the /Library folder. Sort files into clear folders, rename messy names, and write /Library/INDEX.md describing what is where. Inspect with list_dir before moving anything. Never overwrite."},professor:{name:"Professor",place:"Campus",color:"#6B5BD6",blurb:"Keeps course folders, notes and revision sheets.",prompt:"You are the Professor. You own the /Courses folder: one folder per course with notes.md, assignments.md and revision.md. Turn raw notes into clean summaries, flashcards and exam checklists. Write in simple language."},builder:{name:"Builder",place:"Workshop",color:"#D9483B",blurb:"Tracks code projects, READMEs and next steps.",prompt:"You are the Builder. You own the /Projects folder. For each project keep README.md and TODO.md current. Read code files before commenting on them and give specific next steps."},planner:{name:"Planner",place:"Planner's Office",color:"#2F7DE1",blurb:"Maintains tasks, deadlines and a weekly plan.",prompt:"You are the Planner. You own /Planner/tasks.md and /Planner/week.md. Read them first, then add, complete or reschedule tasks. Keep deadlines as dates. Keep the weekly plan realistic."}};var e=c(87550),f=c.n(e),g=c(73024),h=c(76760),i=c.n(h);let j=i().join(process.cwd(),"data","city.db");(0,g.mkdirSync)(i().dirname(j),{recursive:!0});let k=new(f())(j);k.pragma("foreign_keys = ON"),k.exec(`
  CREATE TABLE IF NOT EXISTS users (
    google_id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    image TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cities (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    root_path TEXT NOT NULL,
    owner_id TEXT NOT NULL REFERENCES users(google_id)
  );

  CREATE TABLE IF NOT EXISTS outputs (
    id INTEGER PRIMARY KEY,
    city_id INTEGER NOT NULL REFERENCES cities(id),
    agent TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY,
    city_id INTEGER NOT NULL REFERENCES cities(id),
    started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS google_credentials (
    google_id TEXT PRIMARY KEY NOT NULL REFERENCES users(google_id) ON DELETE CASCADE,
    encrypted_refresh_token TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_settings (
    google_id TEXT PRIMARY KEY NOT NULL REFERENCES users(google_id) ON DELETE CASCADE,
    model TEXT NOT NULL,
    city_root TEXT NOT NULL,
    enabled_agents TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS a2a_tasks (
    owner_id TEXT NOT NULL REFERENCES users(google_id) ON DELETE CASCADE,
    task_id TEXT NOT NULL,
    context_id TEXT NOT NULL,
    status INTEGER NOT NULL,
    status_timestamp TEXT NOT NULL,
    task_json TEXT NOT NULL,
    PRIMARY KEY (owner_id, task_id)
  );

  CREATE INDEX IF NOT EXISTS a2a_tasks_owner_updated
    ON a2a_tasks (owner_id, status_timestamp DESC, task_id DESC);

  CREATE TABLE IF NOT EXISTS document_sources (
    id INTEGER PRIMARY KEY,
    city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(city_id, content_hash)
  );

  CREATE TABLE IF NOT EXISTS document_chunks (
    id INTEGER PRIMARY KEY,
    source_id INTEGER NOT NULL REFERENCES document_sources(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    token_count INTEGER NOT NULL,
    UNIQUE(source_id, chunk_index)
  );

  CREATE INDEX IF NOT EXISTS document_sources_city
    ON document_sources (city_id, id DESC);

  CREATE INDEX IF NOT EXISTS document_chunks_source
    ON document_chunks (source_id, chunk_index);

  CREATE TABLE IF NOT EXISTS scheduled_jobs (
    id INTEGER PRIMARY KEY,
    city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    owner_id TEXT NOT NULL REFERENCES users(google_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    agent TEXT NOT NULL CHECK (agent IN ('mayor', 'librarian', 'professor', 'builder', 'planner')),
    task TEXT NOT NULL,
    weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    local_time TEXT NOT NULL,
    time_zone TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    last_run_date TEXT,
    last_started_at TEXT,
    last_finished_at TEXT,
    last_status TEXT CHECK (last_status IN ('running', 'success', 'failed')),
    last_error TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS scheduled_jobs_city_owner
    ON scheduled_jobs (city_id, owner_id, enabled);
`);var l=c(51455),m=c.n(l),n=c(48161),o=c.n(n);let p=i().resolve((process.env.CITY_ROOT||"~/AgentCity").replace(/^~/,o().homedir()));function q(a){return"object"==typeof a&&null!==a&&"code"in a&&"ENOENT"===a.code}function r(a,b){if(!function(a,b){let c=i().relative(a,b);return""===c||".."!==c&&!c.startsWith(`..${i().sep}`)&&!i().isAbsolute(c)}(a,b))throw Error("Path outside the city")}async function s(a,b=p){if(!i().isAbsolute(a))throw Error("City root must be an absolute path");let c=await m().realpath(b);if((await m().lstat(a)).isSymbolicLink())throw Error("City root cannot be a symbolic link");let d=await m().realpath(a),e=i().relative(c,d);if(!e||".."===e||e.startsWith(`..${i().sep}`)||i().isAbsolute(e)||e.includes(i().sep))throw Error("City root must be a direct subfolder of CITY_ROOT");if(!(await m().stat(d)).isDirectory())throw Error("City root is not a directory");return d}function t(a,b){let c=i().resolve(a,b.replace(/^[/\\]+/,""));return r(a,c),c}async function u(a,b){let c=await m().realpath(b);return r(a,c),c}async function v(a,b){try{await u(a,b)}catch(d){if(!q(d))throw d;try{throw await m().lstat(b),Error("Cannot use an unresolved symbolic link inside the city")}catch(a){if(!q(a))throw a}let c=i().dirname(b);if(c===b)throw d;await v(a,c)}}async function w(a,b){try{return await u(a,b)}catch(c){if(!q(c))throw c;try{throw await m().lstat(b),Error("Cannot write through an unresolved symbolic link")}catch(a){if(!q(a))throw a}return await v(a,i().dirname(b)),b}}let x={type:"string"},y=[{name:"list_dir",description:"List files and folders in a directory",input_schema:{type:"object",properties:{path:x},required:["path"]}},{name:"read_file",description:"Read a text file",input_schema:{type:"object",properties:{path:x},required:["path"]}},{name:"write_file",description:"Create or overwrite a text file",input_schema:{type:"object",properties:{path:x,content:x},required:["path","content"]}},{name:"make_dir",description:"Create a folder",input_schema:{type:"object",properties:{path:x},required:["path"]}},{name:"move",description:"Move or rename a file. Never overwrites.",input_schema:{type:"object",properties:{from:x,to:x},required:["from","to"]}}];async function z(a,b,c,d=p){let e=await s(c,d);switch(a){case"list_dir":{let a=await u(e,t(e,b.path||"."));return(await m().readdir(a,{withFileTypes:!0})).map(a=>a.isDirectory()?a.name+"/":a.name).join("\n")||"(empty)"}case"read_file":return(await m().readFile(await u(e,t(e,b.path)),"utf8")).slice(0,2e4);case"write_file":{let a=t(e,b.path);await v(e,i().dirname(a)),await m().mkdir(i().dirname(a),{recursive:!0});let c=await u(e,i().dirname(a)),d=await w(e,i().join(c,i().basename(a)));return await m().writeFile(d,b.content),"Saved "+b.path}case"make_dir":{let a=t(e,b.path);return await v(e,a),await m().mkdir(a,{recursive:!0}),await u(e,a),"Created "+b.path}case"move":{let a=await u(e,t(e,b.from)),c=t(e,b.to);await v(e,i().dirname(c)),await m().mkdir(i().dirname(c),{recursive:!0});let d=await u(e,i().dirname(c)),f=i().join(d,i().basename(c));try{throw await m().lstat(f),Error("Destination exists")}catch(a){if(!q(a))throw a}return await m().rename(a,f),`Moved ${b.from} to ${b.to}`}}throw Error("Unknown tool "+a)}class A extends Error{constructor(a){super(a),this.name="OutputPersistenceError"}}function B(a){return a instanceof Error?a.message:"Unknown storage error."}async function C(a,b,c,e,f=p){let g;try{g=k.prepare("INSERT INTO outputs (city_id, agent, content) VALUES (?, ?, ?)").run(a,b,c).lastInsertRowid}catch(a){throw new A(`Could not save ${d[b].name}'s output to SQLite: ${B(a)}`)}let h=i().join("outputs",`${g}-${b}.md`),j=[`# ${d[b].place} output`,"",`Output ID: ${g}`,`Generated: ${new Date().toISOString()}`,"",c,""].join("\n");try{await z("write_file",{path:h,content:j},e,f)}catch(a){try{let a=k.prepare("DELETE FROM outputs WHERE id = ?").run(g);if(1!==a.changes)throw Error("The inserted output row could not be found for rollback.")}catch(c){throw new A(`Could not save ${d[b].name}'s output to ${h}: ${B(a)}. SQLite rollback also failed: ${B(c)}`)}throw new A(`Could not save ${d[b].name}'s output to ${h}; its SQLite row was rolled back: ${B(a)}`)}}let D=process.env.OLLAMA_URL||"http://localhost:11434",E=process.env.OLLAMA_MODEL||"llama3.2:3b",F={name:"delegate",description:"Give a task to another agent and get their report back",input_schema:{type:"object",properties:{agent:{type:"string",enum:["librarian","professor","builder","planner"]},task:{type:"string"}},required:["agent","task"]}},G=a=>({type:"function",function:{name:a.name,description:a.description,parameters:a.input_schema}});function H(a){return"object"==typeof a&&null!==a}function I(a){return a instanceof Error?a.message:"Unexpected agent error."}function J(a){return new Promise(b=>setTimeout(b,a))}async function K(a,b,c){for(let d=1;d<=3;d++){let e;try{e=await fetch(`${D}/api/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:c,messages:a,tools:b,stream:!1,options:{temperature:.2,num_ctx:8192}})})}catch{if(3===d)throw Error("Cannot reach Ollama after 3 attempts. Is it running? Try `ollama list` in a terminal.");await J(250*d);continue}if(!e.ok){let a=await e.text();if((408===e.status||429===e.status||e.status>=500)&&d<3){await J(250*d);continue}throw Error(`Ollama error ${e.status}: ${a}`)}try{let a=await e.json();if(!H(a)||!H(a.message))throw Error("Ollama returned an invalid chat response.");return a.message}catch(a){if(3===d)throw Error(`Could not read Ollama's chat response after 3 attempts: ${I(a)}`);await J(250*d)}}throw Error("Ollama request failed after 3 attempts.")}async function L(a,b,c,e,f,g,h,i){let j=b.function.name,k=b.function.arguments||{};if("string"==typeof k)try{k=JSON.parse(k)}catch{k={}}let l=H(k)?k:{},m=[{agent:a,tool:j,input:l}];try{if("delegate"===j){let b=l.agent,f=l.task;if("mayor"!==a||!("string"==typeof b&&"mayor"!==b&&Object.hasOwn(d,b))||"string"!=typeof f)return{name:j,output:"Error: Invalid delegation request.",records:m};if(!i.has(b))return{name:j,output:`Error: ${d[b].name} is disabled in Settings.`,records:m};let k=[];try{let a=await M(b,[{role:"user",content:f}],k,c,g,e,h);return{name:j,output:a,records:[...m,...k]}}catch(a){throw m.push(...k),a}}if(f.has(j)){if(!e)throw Error("The requested MCP integration is unavailable.");let a=await e.callTool({name:j,arguments:l});if(!H(a)||!Array.isArray(a.content))throw Error("The MCP tool returned an invalid response.");let b=a.content.flatMap(a=>H(a)&&"text"===a.type&&"string"==typeof a.text?[a.text]:[]).join("\n");if(!0===a.isError)throw Error(b||"MCP tool call failed.");return{name:j,output:b||JSON.stringify(a.structuredContent??{}),records:m}}return{name:j,output:await z(j,l,c,h.cityRoot??p),records:m}}catch(a){if(a instanceof A)return{name:j,records:m,fatalError:a};return{name:j,output:`Error: ${I(a)}`,records:m}}}async function M(a,b,c,e,f,g,h={}){let i=new Set(h.enabledAgents??Object.keys(d));if(!i.has(a))throw Error(`${d[a].name} is disabled in Settings.`);let j=d[a],k=Object.keys(d).filter(a=>"mayor"!==a&&i.has(a)),l=k.length>0?[y[0],{...F,input_schema:{...F.input_schema,properties:{agent:{type:"string",enum:k},task:{type:"string"}}}}]:[y[0]],m=!1===h.toolsEnabled?[]:("mayor"===a?l:y).map(G),n=h.model||E,o=!1!==h.toolsEnabled&&g&&("planner"===a||"builder"===a)?(await g.listTools()).tools.filter(b=>"planner"===a?b.name.startsWith("google_calendar_"):b.name.startsWith("github_")):[],p=new Set(o.map(a=>a.name)),q=[...m,...o.map(a=>({type:"function",function:{name:a.name,description:a.description??"",parameters:a.inputSchema}}))],r=!1===h.toolsEnabled?`The city root is ${e}. You have no file or external tools for this review.`:`The city root is ${e}. Paths are relative to it. You cannot delete files. Use tools to act. Do not guess file names: call list_dir first.`,s=[{role:"system",content:`${h.systemPrompt??j.prompt}
${r}`},...b];for(let b=0;b<8;b++){let b=await K(s,q,n);s.push(b);let d=b.tool_calls||[];if(0===d.length){let c=(b.content||"").trim()||"Done.";return await f?.(a,c),c}let j=[];if("mayor"===a)j.push(...await Promise.all(d.map(b=>L(a,b,e,g,p,f,h,i))));else for(let b of d)j.push(await L(a,b,e,g,p,f,h,i));for(let a of j)c.push(...a.records);let k=j.find(a=>a.fatalError);if(k?.fatalError)throw k.fatalError;for(let a of j)s.push({role:"tool",tool_name:a.name,content:a.output??""})}let t="I stopped after too many steps. Try a smaller request.";return await f?.(a,t),t}let N=process.env.OLLAMA_MODEL||"llama3.2:3b",O=Object.keys(d);function P(a){return"string"==typeof a&&Object.hasOwn(d,a)}let Q={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};function R(a,b){let c=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:b,weekday:"short",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(a).map(a=>[a.type,a.value]));return{date:`${c.year}-${c.month}-${c.day}`,time:`${c.hour}:${c.minute}`,weekday:Q[c.weekday]}}function S(a,b){let c=R(b,a.time_zone);if(c.weekday!==a.weekday||c.time<a.local_time||a.last_run_date===c.date)return!1;let d=R(new Date(`${a.created_at.replace(" ","T")}Z`),a.time_zone);return d.date!==c.date||d.time<a.local_time}function T(a){return a instanceof Error?a.message:"Unexpected scheduled-job error."}async function U(a,b={}){let c=function(a,b){let c=b?"SELECT * FROM scheduled_jobs WHERE id = ? AND owner_id = ?":"SELECT * FROM scheduled_jobs WHERE id = ?";return b?k.prepare(c).get(a,b):k.prepare(c).get(a)}(a,b.ownerId);if(!c)throw Error("Scheduled job not found.");if(!b.force&&(!c.enabled||!S(c,new Date)))return!1;let e=function(a){let b,c=k.prepare("SELECT model, city_root, enabled_agents FROM user_settings WHERE google_id = ?").get(a);if(!c)return{model:N,cityRoot:p,enabledAgents:[...O]};try{b=JSON.parse(c.enabled_agents)}catch(a){throw Error(`Could not read agent settings for this account: ${a instanceof Error?a.message:"invalid JSON"}`)}if(!Array.isArray(b)||!b.every(P)||new Set(b).size!==b.length)throw Error("Stored agent settings are invalid. Update them from the Settings page.");return{model:c.model,cityRoot:c.city_root,enabledAgents:b.filter(P)}}(c.owner_id);if(!e.enabledAgents.includes(c.agent)){if(b.force)throw Error(`${d[c.agent].name} is disabled in Settings.`);return!1}let f=R(new Date,c.time_zone).date;if(1!==k.prepare(`
    UPDATE scheduled_jobs
    SET last_run_date = ?, last_started_at = CURRENT_TIMESTAMP,
        last_finished_at = NULL, last_status = 'running', last_error = NULL
    WHERE id = ?
      AND (? = 1 OR enabled = 1)
      AND (? = 1 OR last_run_date IS NULL OR last_run_date <> ?)
      AND (
        last_status IS NULL OR last_status <> 'running'
        OR last_started_at < datetime('now', '-2 hours')
      )
  `).run(f,c.id,+!!b.force,+!!b.force,f).changes){if(b.force)throw Error("This scheduled job is already running.");return!1}try{let a=k.prepare("SELECT root_path FROM cities WHERE id = ? AND owner_id = ?").get(c.city_id,c.owner_id);if(!a)throw Error("The city for this scheduled job no longer exists.");let b=await s(a.root_path,e.cityRoot),d=[{role:"user",content:c.task}];return await M(c.agent,d,[],b,(a,d)=>C(c.city_id,a,d,b,e.cityRoot),void 0,e),k.prepare(`
      UPDATE scheduled_jobs
      SET last_status = 'success', last_finished_at = CURRENT_TIMESTAMP, last_error = NULL
      WHERE id = ?
    `).run(c.id),!0}catch(b){let a=T(b).slice(0,2e3);throw k.prepare(`
      UPDATE scheduled_jobs
      SET last_status = 'failed', last_finished_at = CURRENT_TIMESTAMP, last_error = ?
      WHERE id = ?
    `).run(a,c.id),b}}async function V(){for(let a of k.prepare("SELECT * FROM scheduled_jobs WHERE enabled = 1").all())try{S(a,new Date)&&await U(a.id)}catch(b){console.error(`Scheduled job ${a.id} (${d[a.agent].name}) failed:`,T(b))}}function W(){let a=globalThis;if(a.__agentCitySchedulerTimer)return;let b=async()=>{if(!a.__agentCitySchedulerRunning){a.__agentCitySchedulerRunning=!0;try{await V()}catch(a){console.error("Could not check scheduled jobs:",T(a))}finally{a.__agentCitySchedulerRunning=!1}}};a.__agentCitySchedulerTimer=setInterval(()=>{b()},3e4),a.__agentCitySchedulerTimer.unref(),b()}}};