exports.id=671,exports.ids=[671],exports.modules={6688:(a,b,c)=>{"use strict";c.d(b,{M:()=>k,d:()=>i});var d=c(76760),e=c.n(d),f=c(87755),g=c(27143),h=c(31484);class i extends Error{constructor(a){super(a),this.name="OutputPersistenceError"}}function j(a){return a instanceof Error?a.message:"Unknown storage error."}async function k(a,b,c,d,l=h.x$){let m;try{m=g.A.prepare("INSERT INTO outputs (city_id, agent, content) VALUES (?, ?, ?)").run(a,b,c).lastInsertRowid}catch(a){throw new i(`Could not save ${f.j[b].name}'s output to SQLite: ${j(a)}`)}let n=e().join("outputs",`${m}-${b}.md`),o=[`# ${f.j[b].place} output`,"",`Output ID: ${m}`,`Generated: ${new Date().toISOString()}`,"",c,""].join("\n");try{await (0,h.X_)("write_file",{path:n,content:o},d,l)}catch(a){try{let a=g.A.prepare("DELETE FROM outputs WHERE id = ?").run(m);if(1!==a.changes)throw Error("The inserted output row could not be found for rollback.")}catch(c){throw new i(`Could not save ${f.j[b].name}'s output to ${n}: ${j(a)}. SQLite rollback also failed: ${j(c)}`)}throw new i(`Could not save ${f.j[b].name}'s output to ${n}; its SQLite row was rolled back: ${j(a)}`)}}},27143:(a,b,c)=>{"use strict";c.d(b,{A:()=>k});var d=c(87550),e=c.n(d),f=c(73024),g=c(76760),h=c.n(g);let i=h().join(process.cwd(),"data","city.db");(0,f.mkdirSync)(h().dirname(i),{recursive:!0});let j=new(e())(i);j.pragma("foreign_keys = ON"),j.exec(`
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
`);let k=j},31484:(a,b,c)=>{"use strict";c.d(b,{X_:()=>t,YN:()=>m,dO:()=>s,kl:()=>v,nV:()=>u,x$:()=>j});var d=c(51455),e=c.n(d),f=c(48161),g=c.n(f),h=c(76760),i=c.n(h);let j=i().resolve((process.env.CITY_ROOT||"~/AgentCity").replace(/^~/,g().homedir()));function k(a){return"object"==typeof a&&null!==a&&"code"in a&&"ENOENT"===a.code}function l(a,b){if(!function(a,b){let c=i().relative(a,b);return""===c||".."!==c&&!c.startsWith(`..${i().sep}`)&&!i().isAbsolute(c)}(a,b))throw Error("Path outside the city")}async function m(a,b=j){if(!i().isAbsolute(a))throw Error("City root must be an absolute path");let c=await e().realpath(b);if((await e().lstat(a)).isSymbolicLink())throw Error("City root cannot be a symbolic link");let d=await e().realpath(a),f=i().relative(c,d);if(!f||".."===f||f.startsWith(`..${i().sep}`)||i().isAbsolute(f)||f.includes(i().sep))throw Error("City root must be a direct subfolder of CITY_ROOT");if(!(await e().stat(d)).isDirectory())throw Error("City root is not a directory");return d}function n(a,b){let c=i().resolve(a,b.replace(/^[/\\]+/,""));return l(a,c),c}async function o(a,b){let c=await e().realpath(b);return l(a,c),c}async function p(a,b){try{await o(a,b)}catch(d){if(!k(d))throw d;try{throw await e().lstat(b),Error("Cannot use an unresolved symbolic link inside the city")}catch(a){if(!k(a))throw a}let c=i().dirname(b);if(c===b)throw d;await p(a,c)}}async function q(a,b){try{return await o(a,b)}catch(c){if(!k(c))throw c;try{throw await e().lstat(b),Error("Cannot write through an unresolved symbolic link")}catch(a){if(!k(a))throw a}return await p(a,i().dirname(b)),b}}let r={type:"string"},s=[{name:"list_dir",description:"List files and folders in a directory",input_schema:{type:"object",properties:{path:r},required:["path"]}},{name:"read_file",description:"Read a text file",input_schema:{type:"object",properties:{path:r},required:["path"]}},{name:"write_file",description:"Create or overwrite a text file",input_schema:{type:"object",properties:{path:r,content:r},required:["path","content"]}},{name:"make_dir",description:"Create a folder",input_schema:{type:"object",properties:{path:r},required:["path"]}},{name:"move",description:"Move or rename a file. Never overwrites.",input_schema:{type:"object",properties:{from:r,to:r},required:["from","to"]}}];async function t(a,b,c,d=j){let f=await m(c,d);switch(a){case"list_dir":{let a=await o(f,n(f,b.path||"."));return(await e().readdir(a,{withFileTypes:!0})).map(a=>a.isDirectory()?a.name+"/":a.name).join("\n")||"(empty)"}case"read_file":return(await e().readFile(await o(f,n(f,b.path)),"utf8")).slice(0,2e4);case"write_file":{let a=n(f,b.path);await p(f,i().dirname(a)),await e().mkdir(i().dirname(a),{recursive:!0});let c=await o(f,i().dirname(a)),d=await q(f,i().join(c,i().basename(a)));return await e().writeFile(d,b.content),"Saved "+b.path}case"make_dir":{let a=n(f,b.path);return await p(f,a),await e().mkdir(a,{recursive:!0}),await o(f,a),"Created "+b.path}case"move":{let a=await o(f,n(f,b.from)),c=n(f,b.to);await p(f,i().dirname(c)),await e().mkdir(i().dirname(c),{recursive:!0});let d=await o(f,i().dirname(c)),g=i().join(d,i().basename(c));try{throw await e().lstat(g),Error("Destination exists")}catch(a){if(!k(a))throw a}return await e().rename(a,g),`Moved ${b.from} to ${b.to}`}}throw Error("Unknown tool "+a)}async function u(a,b,c,d=j){let f=await m(c,d),g=n(f,a);await p(f,i().dirname(g)),await e().mkdir(i().dirname(g),{recursive:!0});let h=await o(f,i().dirname(g)),k=i().join(h,i().basename(g));await q(f,k),await e().writeFile(k,b,{flag:"wx"})}async function v(a,b,c=j){let d=await m(b,c),f=await o(d,n(d,a));return e().readFile(f)}},46348:(a,b,c)=>{"use strict";c.d(b,{J:()=>p,S:()=>q});var d=c(87755),e=c(31484),f=c(6688);let g=process.env.OLLAMA_URL||"http://localhost:11434",h=process.env.OLLAMA_MODEL||"llama3.2:3b",i={name:"delegate",description:"Give a task to another agent and get their report back",input_schema:{type:"object",properties:{agent:{type:"string",enum:["librarian","professor","builder","planner"]},task:{type:"string"}},required:["agent","task"]}},j=a=>({type:"function",function:{name:a.name,description:a.description,parameters:a.input_schema}});function k(a){return"object"==typeof a&&null!==a}function l(a){return a instanceof Error?a.message:"Unexpected agent error."}function m(a){return new Promise(b=>setTimeout(b,a))}async function n(a,b,c){for(let d=1;d<=3;d++){let e;try{e=await fetch(`${g}/api/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:c,messages:a,tools:b,stream:!1,options:{temperature:.2,num_ctx:8192}})})}catch{if(3===d)throw Error("Cannot reach Ollama after 3 attempts. Is it running? Try `ollama list` in a terminal.");await m(250*d);continue}if(!e.ok){let a=await e.text();if((408===e.status||429===e.status||e.status>=500)&&d<3){await m(250*d);continue}throw Error(`Ollama error ${e.status}: ${a}`)}try{let a=await e.json();if(!k(a)||!k(a.message))throw Error("Ollama returned an invalid chat response.");return a.message}catch(a){if(3===d)throw Error(`Could not read Ollama's chat response after 3 attempts: ${l(a)}`);await m(250*d)}}throw Error("Ollama request failed after 3 attempts.")}async function o(a,b,c,g,h,i,j,m){let n=b.function.name,o=b.function.arguments||{};if("string"==typeof o)try{o=JSON.parse(o)}catch{o={}}let q=k(o)?o:{},r=[{agent:a,tool:n,input:q}];try{if("delegate"===n){let b=q.agent,e=q.task;if("mayor"!==a||!("string"==typeof b&&"mayor"!==b&&Object.hasOwn(d.j,b))||"string"!=typeof e)return{name:n,output:"Error: Invalid delegation request.",records:r};if(!m.has(b))return{name:n,output:`Error: ${d.j[b].name} is disabled in Settings.`,records:r};let f=[];try{let a=await p(b,[{role:"user",content:e}],f,c,i,g,j);return{name:n,output:a,records:[...r,...f]}}catch(a){throw r.push(...f),a}}if(h.has(n)){if(!g)throw Error("The requested MCP integration is unavailable.");let a=await g.callTool({name:n,arguments:q});if(!k(a)||!Array.isArray(a.content))throw Error("The MCP tool returned an invalid response.");let b=a.content.flatMap(a=>k(a)&&"text"===a.type&&"string"==typeof a.text?[a.text]:[]).join("\n");if(!0===a.isError)throw Error(b||"MCP tool call failed.");return{name:n,output:b||JSON.stringify(a.structuredContent??{}),records:r}}return{name:n,output:await (0,e.X_)(n,q,c,j.cityRoot??e.x$),records:r}}catch(a){if(a instanceof f.d)return{name:n,records:r,fatalError:a};return{name:n,output:`Error: ${l(a)}`,records:r}}}async function p(a,b,c,f,g,k,l={}){let m=new Set(l.enabledAgents??Object.keys(d.j));if(!m.has(a))throw Error(`${d.j[a].name} is disabled in Settings.`);let q=d.j[a],r=Object.keys(d.j).filter(a=>"mayor"!==a&&m.has(a)),s=r.length>0?[e.dO[0],{...i,input_schema:{...i.input_schema,properties:{agent:{type:"string",enum:r},task:{type:"string"}}}}]:[e.dO[0]],t=!1===l.toolsEnabled?[]:("mayor"===a?s:e.dO).map(j),u=l.model||h,v=!1!==l.toolsEnabled&&k&&("planner"===a||"builder"===a)?(await k.listTools()).tools.filter(b=>"planner"===a?b.name.startsWith("google_calendar_"):b.name.startsWith("github_")):[],w=new Set(v.map(a=>a.name)),x=[...t,...v.map(a=>({type:"function",function:{name:a.name,description:a.description??"",parameters:a.inputSchema}}))],y=!1===l.toolsEnabled?`The city root is ${f}. You have no file or external tools for this review.`:`The city root is ${f}. Paths are relative to it. You cannot delete files. Use tools to act. Do not guess file names: call list_dir first.`,z=[{role:"system",content:`${l.systemPrompt??q.prompt}
${y}`},...b];for(let b=0;b<8;b++){let b=await n(z,x,u);z.push(b);let d=b.tool_calls||[];if(0===d.length){let c=(b.content||"").trim()||"Done.";return await g?.(a,c),c}let e=[];if("mayor"===a)e.push(...await Promise.all(d.map(b=>o(a,b,f,k,w,g,l,m))));else for(let b of d)e.push(await o(a,b,f,k,w,g,l,m));for(let a of e)c.push(...a.records);let h=e.find(a=>a.fatalError);if(h?.fatalError)throw h.fatalError;for(let a of e)z.push({role:"tool",tool_name:a.name,content:a.output??""})}let A="I stopped after too many steps. Try a smaller request.";return await g?.(a,A),A}async function q(a,b,c){let d=await n([{role:"system",content:a},{role:"user",content:b}],[],c);if(d.tool_calls?.length)throw Error("The selected Ollama model returned a tool call when no tools were available.");let e=d.content?.trim();if(!e)throw Error("The selected Ollama model returned an empty response.");return e}},70618:(a,b,c)=>{"use strict";c.d(b,{h:()=>j,u:()=>k});var d=c(87755),e=c(31484),f=c(27143);let g=process.env.OLLAMA_MODEL||"llama3.2:3b",h=Object.keys(d.j);function i(a){return"string"==typeof a&&Object.hasOwn(d.j,a)}function j(a){let b,c=f.A.prepare("SELECT model, city_root, enabled_agents FROM user_settings WHERE google_id = ?").get(a);if(!c)return{model:g,cityRoot:e.x$,enabledAgents:[...h]};try{b=JSON.parse(c.enabled_agents)}catch(a){throw Error(`Could not read agent settings for this account: ${a instanceof Error?a.message:"invalid JSON"}`)}if(!Array.isArray(b)||!b.every(i)||new Set(b).size!==b.length)throw Error("Stored agent settings are invalid. Update them from the Settings page.");return{model:c.model,cityRoot:c.city_root,enabledAgents:b.filter(i)}}function k(a,b){f.A.prepare(`
    INSERT INTO user_settings (google_id, model, city_root, enabled_agents)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(google_id) DO UPDATE SET
      model = excluded.model,
      city_root = excluded.city_root,
      enabled_agents = excluded.enabled_agents,
      updated_at = CURRENT_TIMESTAMP
  `).run(a,b.model,b.cityRoot,JSON.stringify(b.enabledAgents))}},71761:(a,b,c)=>{"use strict";c.d(b,{d:()=>g,r:()=>h});var d=c(77598),e=c(27143);function f(){let a=process.env.AUTH_SECRET;if(!a)throw Error("AUTH_SECRET is required to protect Google Calendar credentials.");return(0,d.createHash)("sha256").update(a).digest()}function g(a,b){let c=(0,d.randomBytes)(12),g=(0,d.createCipheriv)("aes-256-gcm",f(),c),h=Buffer.concat([g.update(b,"utf8"),g.final()]),i=[c.toString("hex"),g.getAuthTag().toString("hex"),h.toString("hex")].join(":");e.A.prepare(`
    INSERT INTO google_credentials (google_id, encrypted_refresh_token, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(google_id) DO UPDATE SET
      encrypted_refresh_token = excluded.encrypted_refresh_token,
      updated_at = CURRENT_TIMESTAMP
  `).run(a,i)}async function h(a){let b=process.env.AUTH_GOOGLE_ID,c=process.env.AUTH_GOOGLE_SECRET;if(!b||!c)throw Error("AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are required for Calendar access.");let h=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:b,client_secret:c,refresh_token:function(a){let b=e.A.prepare("SELECT encrypted_refresh_token FROM google_credentials WHERE google_id = ?").get(a);if(!b)throw Error("Google Calendar is not connected. Sign out and sign in again to grant Calendar access.");let[c,g,h]=b.encrypted_refresh_token.split(":");if(!c||!g||!h)throw Error("Stored Google Calendar credentials are invalid.");try{let a=(0,d.createDecipheriv)("aes-256-gcm",f(),Buffer.from(c,"hex"));return a.setAuthTag(Buffer.from(g,"hex")),Buffer.concat([a.update(Buffer.from(h,"hex")),a.final()]).toString("utf8")}catch{throw Error("Could not decrypt Google Calendar credentials. Check AUTH_SECRET and sign in again.")}}(a),grant_type:"refresh_token"})}),i=await h.json();if(!h.ok)throw Error("object"==typeof i&&null!==i&&"error_description"in i&&"string"==typeof i.error_description?i.error_description:`Google token refresh failed (${h.status}).`);if("object"!=typeof i||null===i||!("access_token"in i)||"string"!=typeof i.access_token)throw Error("Google returned an invalid token response.");return"refresh_token"in i&&"string"==typeof i.refresh_token&&g(a,i.refresh_token),i.access_token}},78335:()=>{},87755:(a,b,c)=>{"use strict";c.d(b,{j:()=>d});let d={mayor:{name:"Mayor",place:"Town Hall",color:"#1F3A36",blurb:"Takes any request and sends it to the right agent.",prompt:"You are the Mayor of Agent City, which manages the user's files. You do not edit files yourself. Pick the right agent with the delegate tool (librarian: loose files and organizing, professor: course notes and study material, builder: code projects, planner: tasks, deadlines, schedules). Split big requests into several delegations. Then summarize what happened in a few sentences."},librarian:{name:"Librarian",place:"Library",color:"#D9972B",blurb:"Sorts and renames files, keeps the Library folder tidy.",prompt:"You are the Librarian. You own the /Library folder. Sort files into clear folders, rename messy names, and write /Library/INDEX.md describing what is where. Inspect with list_dir before moving anything. Never overwrite."},professor:{name:"Professor",place:"Campus",color:"#6B5BD6",blurb:"Keeps course folders, notes and revision sheets.",prompt:"You are the Professor. You own the /Courses folder: one folder per course with notes.md, assignments.md and revision.md. Turn raw notes into clean summaries, flashcards and exam checklists. Write in simple language."},builder:{name:"Builder",place:"Workshop",color:"#D9483B",blurb:"Tracks code projects, READMEs and next steps.",prompt:"You are the Builder. You own the /Projects folder. For each project keep README.md and TODO.md current. Read code files before commenting on them and give specific next steps."},planner:{name:"Planner",place:"Planner's Office",color:"#2F7DE1",blurb:"Maintains tasks, deadlines and a weekly plan.",prompt:"You are the Planner. You own /Planner/tasks.md and /Planner/week.md. Read them first, then add, complete or reschedule tasks. Keep deadlines as dates. Keep the weekly plan realistic."}}},96487:()=>{}};