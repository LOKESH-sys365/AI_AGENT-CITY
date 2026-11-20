exports.id=407,exports.ids=[407],exports.modules={16953:(a,b,c)=>{"use strict";c.r(b),c.d(b,{default:()=>f,metadata:()=>e});var d=c(75338);c(82704);let e={title:"Agent City"};function f({children:a}){return(0,d.jsxs)("html",{lang:"en",children:[(0,d.jsxs)("head",{children:[(0,d.jsx)("link",{rel:"preconnect",href:"https://fonts.googleapis.com"}),(0,d.jsx)("link",{href:"https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&display=swap",rel:"stylesheet"})]}),(0,d.jsx)("body",{children:a})]})}},27143:(a,b,c)=>{"use strict";c.d(b,{A:()=>k});var d=c(87550),e=c.n(d),f=c(73024),g=c(76760),h=c.n(g);let i=h().join(process.cwd(),"data","city.db");(0,f.mkdirSync)(h().dirname(i),{recursive:!0});let j=new(e())(i);j.pragma("foreign_keys = ON"),j.exec(`
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
`);let k=j},29010:(a,b,c)=>{Promise.resolve().then(c.t.bind(c,81170,23)),Promise.resolve().then(c.t.bind(c,23597,23)),Promise.resolve().then(c.t.bind(c,36893,23)),Promise.resolve().then(c.t.bind(c,89748,23)),Promise.resolve().then(c.t.bind(c,6060,23)),Promise.resolve().then(c.t.bind(c,7184,23)),Promise.resolve().then(c.t.bind(c,69576,23)),Promise.resolve().then(c.t.bind(c,73041,23)),Promise.resolve().then(c.t.bind(c,51384,23))},30163:(a,b,c)=>{"use strict";c.d(b,{AZ:()=>e,C0:()=>g,XM:()=>f});var d=c(27143);function e(a){d.A.prepare(`
    INSERT INTO users (google_id, name, email, image)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(google_id) DO UPDATE SET
      name = excluded.name,
      email = excluded.email,
      image = excluded.image
  `).run(a.googleId,a.name,a.email,a.image)}function f(a){return!!d.A.prepare("SELECT 1 FROM users WHERE google_id = ?").get(a)}function g(a){let b=d.A.prepare("SELECT google_id FROM users WHERE email = ? COLLATE NOCASE LIMIT 2").all(a);return 1===b.length?b[0].google_id:void 0}},31484:(a,b,c)=>{"use strict";c.d(b,{X_:()=>t,YN:()=>m,dO:()=>s,kl:()=>v,nV:()=>u,x$:()=>j});var d=c(51455),e=c.n(d),f=c(48161),g=c.n(f),h=c(76760),i=c.n(h);let j=i().resolve((process.env.CITY_ROOT||"~/AgentCity").replace(/^~/,g().homedir()));function k(a){return"object"==typeof a&&null!==a&&"code"in a&&"ENOENT"===a.code}function l(a,b){if(!function(a,b){let c=i().relative(a,b);return""===c||".."!==c&&!c.startsWith(`..${i().sep}`)&&!i().isAbsolute(c)}(a,b))throw Error("Path outside the city")}async function m(a,b=j){if(!i().isAbsolute(a))throw Error("City root must be an absolute path");let c=await e().realpath(b);if((await e().lstat(a)).isSymbolicLink())throw Error("City root cannot be a symbolic link");let d=await e().realpath(a),f=i().relative(c,d);if(!f||".."===f||f.startsWith(`..${i().sep}`)||i().isAbsolute(f)||f.includes(i().sep))throw Error("City root must be a direct subfolder of CITY_ROOT");if(!(await e().stat(d)).isDirectory())throw Error("City root is not a directory");return d}function n(a,b){let c=i().resolve(a,b.replace(/^[/\\]+/,""));return l(a,c),c}async function o(a,b){let c=await e().realpath(b);return l(a,c),c}async function p(a,b){try{await o(a,b)}catch(d){if(!k(d))throw d;try{throw await e().lstat(b),Error("Cannot use an unresolved symbolic link inside the city")}catch(a){if(!k(a))throw a}let c=i().dirname(b);if(c===b)throw d;await p(a,c)}}async function q(a,b){try{return await o(a,b)}catch(c){if(!k(c))throw c;try{throw await e().lstat(b),Error("Cannot write through an unresolved symbolic link")}catch(a){if(!k(a))throw a}return await p(a,i().dirname(b)),b}}let r={type:"string"},s=[{name:"list_dir",description:"List files and folders in a directory",input_schema:{type:"object",properties:{path:r},required:["path"]}},{name:"read_file",description:"Read a text file",input_schema:{type:"object",properties:{path:r},required:["path"]}},{name:"write_file",description:"Create or overwrite a text file",input_schema:{type:"object",properties:{path:r,content:r},required:["path","content"]}},{name:"make_dir",description:"Create a folder",input_schema:{type:"object",properties:{path:r},required:["path"]}},{name:"move",description:"Move or rename a file. Never overwrites.",input_schema:{type:"object",properties:{from:r,to:r},required:["from","to"]}}];async function t(a,b,c,d=j){let f=await m(c,d);switch(a){case"list_dir":{let a=await o(f,n(f,b.path||"."));return(await e().readdir(a,{withFileTypes:!0})).map(a=>a.isDirectory()?a.name+"/":a.name).join("\n")||"(empty)"}case"read_file":return(await e().readFile(await o(f,n(f,b.path)),"utf8")).slice(0,2e4);case"write_file":{let a=n(f,b.path);await p(f,i().dirname(a)),await e().mkdir(i().dirname(a),{recursive:!0});let c=await o(f,i().dirname(a)),d=await q(f,i().join(c,i().basename(a)));return await e().writeFile(d,b.content),"Saved "+b.path}case"make_dir":{let a=n(f,b.path);return await p(f,a),await e().mkdir(a,{recursive:!0}),await o(f,a),"Created "+b.path}case"move":{let a=await o(f,n(f,b.from)),c=n(f,b.to);await p(f,i().dirname(c)),await e().mkdir(i().dirname(c),{recursive:!0});let d=await o(f,i().dirname(c)),g=i().join(d,i().basename(c));try{throw await e().lstat(g),Error("Destination exists")}catch(a){if(!k(a))throw a}return await e().rename(a,g),`Moved ${b.from} to ${b.to}`}}throw Error("Unknown tool "+a)}async function u(a,b,c,d=j){let f=await m(c,d),g=n(f,a);await p(f,i().dirname(g)),await e().mkdir(i().dirname(g),{recursive:!0});let h=await o(f,i().dirname(g)),k=i().join(h,i().basename(g));await q(f,k),await e().writeFile(k,b,{flag:"wx"})}async function v(a,b,c=j){let d=await m(b,c),f=await o(d,n(d,a));return e().readFile(f)}},32988:()=>{},33683:(a,b,c)=>{"use strict";c.d(b,{Jv:()=>j,Y9:()=>h,j2:()=>i});var d=c(19240),e=c(11849),f=c(30163),g=c(71761);let{handlers:h,auth:i,signIn:j,signOut:k}=(0,d.Ay)({providers:[(0,e.A)({clientId:process.env.AUTH_GOOGLE_ID,clientSecret:process.env.AUTH_GOOGLE_SECRET,authorization:{params:{scope:"openid email profile https://www.googleapis.com/auth/calendar.events",access_type:"offline"}}})],pages:{signIn:"/login"},session:{strategy:"jwt"},callbacks:{jwt({token:a,user:b,account:c}){if(c?.provider==="google"){if(a.googleId=c.providerAccountId,a.sub=c.providerAccountId,!c.providerAccountId||!b.name||!b.email)throw Error("Google sign-in did not provide the required profile details.");let d=b.image??"";a.name=b.name,a.email=b.email,a.picture=d,(0,f.AZ)({googleId:c.providerAccountId,name:b.name,email:b.email,image:d}),"string"==typeof c.refresh_token&&(0,g.d)(c.providerAccountId,c.refresh_token)}else!a.googleId&&a.sub&&(a.googleId=a.sub);return b&&(a.sub??=b.id,a.name??=b.name,a.email??=b.email,a.picture??=b.image),a},session({session:a,token:b}){if(a.user){a.user.name=b.name??"",a.user.email=b.email??"",a.user.image="string"==typeof b.picture?b.picture:"";let c=b.googleId??b.sub;"string"==typeof c&&(a.user.googleId=c)}return a}}})},37885:(a,b,c)=>{"use strict";c.d(b,{j:()=>d});let d={mayor:{name:"Mayor",place:"Town Hall",color:"#1F3A36",blurb:"Takes any request and sends it to the right agent.",prompt:"You are the Mayor of Agent City, which manages the user's files. You do not edit files yourself. Pick the right agent with the delegate tool (librarian: loose files and organizing, professor: course notes and study material, builder: code projects, planner: tasks, deadlines, schedules). Split big requests into several delegations. Then summarize what happened in a few sentences."},librarian:{name:"Librarian",place:"Library",color:"#D9972B",blurb:"Sorts and renames files, keeps the Library folder tidy.",prompt:"You are the Librarian. You own the /Library folder. Sort files into clear folders, rename messy names, and write /Library/INDEX.md describing what is where. Inspect with list_dir before moving anything. Never overwrite."},professor:{name:"Professor",place:"Campus",color:"#6B5BD6",blurb:"Keeps course folders, notes and revision sheets.",prompt:"You are the Professor. You own the /Courses folder: one folder per course with notes.md, assignments.md and revision.md. Turn raw notes into clean summaries, flashcards and exam checklists. Write in simple language."},builder:{name:"Builder",place:"Workshop",color:"#D9483B",blurb:"Tracks code projects, READMEs and next steps.",prompt:"You are the Builder. You own the /Projects folder. For each project keep README.md and TODO.md current. Read code files before commenting on them and give specific next steps."},planner:{name:"Planner",place:"Planner's Office",color:"#2F7DE1",blurb:"Maintains tasks, deadlines and a weekly plan.",prompt:"You are the Planner. You own /Planner/tasks.md and /Planner/week.md. Read them first, then add, complete or reschedule tasks. Keep deadlines as dates. Keep the weekly plan realistic."}}},45470:(a,b,c)=>{"use strict";c.d(b,{E:()=>f});var d=c(33683),e=c(30163);async function f(){let a=await (0,d.j2)(),b=a?.user;if(!b)return null;let c=b.googleId;return c&&b.name&&b.email&&b.image?((0,e.AZ)({googleId:c,name:b.name,email:b.email,image:b.image}),c):c&&(0,e.XM)(c)?c:b.email&&(c=(0,e.C0)(b.email))?(b.name&&b.email&&b.image&&(0,e.AZ)({googleId:c,name:b.name,email:b.email,image:b.image}),c):null}},70618:(a,b,c)=>{"use strict";c.d(b,{h:()=>j,u:()=>k});var d=c(87755),e=c(31484),f=c(27143);let g=process.env.OLLAMA_MODEL||"llama3.2:3b",h=Object.keys(d.j);function i(a){return"string"==typeof a&&Object.hasOwn(d.j,a)}function j(a){let b,c=f.A.prepare("SELECT model, city_root, enabled_agents FROM user_settings WHERE google_id = ?").get(a);if(!c)return{model:g,cityRoot:e.x$,enabledAgents:[...h]};try{b=JSON.parse(c.enabled_agents)}catch(a){throw Error(`Could not read agent settings for this account: ${a instanceof Error?a.message:"invalid JSON"}`)}if(!Array.isArray(b)||!b.every(i)||new Set(b).size!==b.length)throw Error("Stored agent settings are invalid. Update them from the Settings page.");return{model:c.model,cityRoot:c.city_root,enabledAgents:b.filter(i)}}function k(a,b){f.A.prepare(`
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
  `).run(a,i)}async function h(a){let b=process.env.AUTH_GOOGLE_ID,c=process.env.AUTH_GOOGLE_SECRET;if(!b||!c)throw Error("AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are required for Calendar access.");let h=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:b,client_secret:c,refresh_token:function(a){let b=e.A.prepare("SELECT encrypted_refresh_token FROM google_credentials WHERE google_id = ?").get(a);if(!b)throw Error("Google Calendar is not connected. Sign out and sign in again to grant Calendar access.");let[c,g,h]=b.encrypted_refresh_token.split(":");if(!c||!g||!h)throw Error("Stored Google Calendar credentials are invalid.");try{let a=(0,d.createDecipheriv)("aes-256-gcm",f(),Buffer.from(c,"hex"));return a.setAuthTag(Buffer.from(g,"hex")),Buffer.concat([a.update(Buffer.from(h,"hex")),a.final()]).toString("utf8")}catch{throw Error("Could not decrypt Google Calendar credentials. Check AUTH_SECRET and sign in again.")}}(a),grant_type:"refresh_token"})}),i=await h.json();if(!h.ok)throw Error("object"==typeof i&&null!==i&&"error_description"in i&&"string"==typeof i.error_description?i.error_description:`Google token refresh failed (${h.status}).`);if("object"!=typeof i||null===i||!("access_token"in i)||"string"!=typeof i.access_token)throw Error("Google returned an invalid token response.");return"refresh_token"in i&&"string"==typeof i.refresh_token&&g(a,i.refresh_token),i.access_token}},75866:(a,b,c)=>{Promise.resolve().then(c.t.bind(c,54160,23)),Promise.resolve().then(c.t.bind(c,31603,23)),Promise.resolve().then(c.t.bind(c,68495,23)),Promise.resolve().then(c.t.bind(c,75170,23)),Promise.resolve().then(c.t.bind(c,77526,23)),Promise.resolve().then(c.t.bind(c,78922,23)),Promise.resolve().then(c.t.bind(c,29234,23)),Promise.resolve().then(c.t.bind(c,12263,23)),Promise.resolve().then(c.bind(c,82146))},82704:()=>{},87755:(a,b,c)=>{"use strict";c.d(b,{j:()=>d});let d={mayor:{name:"Mayor",place:"Town Hall",color:"#1F3A36",blurb:"Takes any request and sends it to the right agent.",prompt:"You are the Mayor of Agent City, which manages the user's files. You do not edit files yourself. Pick the right agent with the delegate tool (librarian: loose files and organizing, professor: course notes and study material, builder: code projects, planner: tasks, deadlines, schedules). Split big requests into several delegations. Then summarize what happened in a few sentences."},librarian:{name:"Librarian",place:"Library",color:"#D9972B",blurb:"Sorts and renames files, keeps the Library folder tidy.",prompt:"You are the Librarian. You own the /Library folder. Sort files into clear folders, rename messy names, and write /Library/INDEX.md describing what is where. Inspect with list_dir before moving anything. Never overwrite."},professor:{name:"Professor",place:"Campus",color:"#6B5BD6",blurb:"Keeps course folders, notes and revision sheets.",prompt:"You are the Professor. You own the /Courses folder: one folder per course with notes.md, assignments.md and revision.md. Turn raw notes into clean summaries, flashcards and exam checklists. Write in simple language."},builder:{name:"Builder",place:"Workshop",color:"#D9483B",blurb:"Tracks code projects, READMEs and next steps.",prompt:"You are the Builder. You own the /Projects folder. For each project keep README.md and TODO.md current. Read code files before commenting on them and give specific next steps."},planner:{name:"Planner",place:"Planner's Office",color:"#2F7DE1",blurb:"Maintains tasks, deadlines and a weekly plan.",prompt:"You are the Planner. You own /Planner/tasks.md and /Planner/week.md. Read them first, then add, complete or reschedule tasks. Keep deadlines as dates. Keep the weekly plan realistic."}}},91132:()=>{}};