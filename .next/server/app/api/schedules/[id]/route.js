(()=>{var a={};a.id=570,a.ids=[570],a.modules={261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},3295:a=>{"use strict";a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},3421:(a,b,c)=>{"use strict";Object.defineProperty(b,"I",{enumerable:!0,get:function(){return h}});let d=c(71237),e=c(55088),f=c(17679),g=["content-length","content-encoding","transfer-encoding"];async function h(a,b,c,h){if((0,d.isNodeNextResponse)(b)){var i;b.statusCode=c.status,b.statusMessage=c.statusText;let d=["set-cookie","www-authenticate","proxy-authenticate","vary"];null==(i=c.headers)||i.forEach((a,c)=>{if("x-middleware-set-cookie"!==c.toLowerCase()&&!g.includes(c))if("set-cookie"===c.toLowerCase())for(let d of(0,f.splitCookiesString)(a))b.appendHeader(c,d);else{let e=void 0!==b.getHeader(c);(d.includes(c.toLowerCase())||!e)&&b.appendHeader(c,a)}});let{originalResponse:j}=b;c.body&&"HEAD"!==a.method?await (0,e.pipeToNodeResponse)(c.body,j,h):j.end()}}},10846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},19121:a=>{"use strict";a.exports=require("next/dist/server/app-render/action-async-storage.external.js")},27143:(a,b,c)=>{"use strict";c.d(b,{A:()=>k});var d=c(87550),e=c.n(d),f=c(73024),g=c(76760),h=c.n(g);let i=h().join(process.cwd(),"data","city.db");(0,f.mkdirSync)(h().dirname(i),{recursive:!0});let j=new(e())(i);j.pragma("foreign_keys = ON"),j.exec(`
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
`);let k=j},29294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},30163:(a,b,c)=>{"use strict";c.d(b,{AZ:()=>e,C0:()=>g,XM:()=>f});var d=c(27143);function e(a){d.A.prepare(`
    INSERT INTO users (google_id, name, email, image)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(google_id) DO UPDATE SET
      name = excluded.name,
      email = excluded.email,
      image = excluded.image
  `).run(a.googleId,a.name,a.email,a.image)}function f(a){return!!d.A.prepare("SELECT 1 FROM users WHERE google_id = ?").get(a)}function g(a){let b=d.A.prepare("SELECT google_id FROM users WHERE email = ? COLLATE NOCASE LIMIT 2").all(a);return 1===b.length?b[0].google_id:void 0}},33683:(a,b,c)=>{"use strict";c.d(b,{Jv:()=>j,Y9:()=>h,j2:()=>i});var d=c(19240),e=c(11849),f=c(30163),g=c(71761);let{handlers:h,auth:i,signIn:j,signOut:k}=(0,d.Ay)({providers:[(0,e.A)({clientId:process.env.AUTH_GOOGLE_ID,clientSecret:process.env.AUTH_GOOGLE_SECRET,authorization:{params:{scope:"openid email profile https://www.googleapis.com/auth/calendar.events",access_type:"offline"}}})],pages:{signIn:"/login"},session:{strategy:"jwt"},callbacks:{jwt({token:a,user:b,account:c}){if(c?.provider==="google"){if(a.googleId=c.providerAccountId,a.sub=c.providerAccountId,!c.providerAccountId||!b.name||!b.email)throw Error("Google sign-in did not provide the required profile details.");let d=b.image??"";a.name=b.name,a.email=b.email,a.picture=d,(0,f.AZ)({googleId:c.providerAccountId,name:b.name,email:b.email,image:d}),"string"==typeof c.refresh_token&&(0,g.d)(c.providerAccountId,c.refresh_token)}else!a.googleId&&a.sub&&(a.googleId=a.sub);return b&&(a.sub??=b.id,a.name??=b.name,a.email??=b.email,a.picture??=b.image),a},session({session:a,token:b}){if(a.user){a.user.name=b.name??"",a.user.email=b.email??"",a.user.image="string"==typeof b.picture?b.picture:"";let c=b.googleId??b.sub;"string"==typeof c&&(a.user.googleId=c)}return a}}})},33873:a=>{"use strict";a.exports=require("path")},44870:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},45470:(a,b,c)=>{"use strict";c.d(b,{E:()=>f});var d=c(33683),e=c(30163);async function f(){let a=await (0,d.j2)(),b=a?.user;if(!b)return null;let c=b.googleId;return c&&b.name&&b.email&&b.image?((0,e.AZ)({googleId:c,name:b.name,email:b.email,image:b.image}),c):c&&(0,e.XM)(c)?c:b.email&&(c=(0,e.C0)(b.email))?(b.name&&b.email&&b.image&&(0,e.AZ)({googleId:c,name:b.name,email:b.email,image:b.image}),c):null}},55511:a=>{"use strict";a.exports=require("crypto")},63033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},71761:(a,b,c)=>{"use strict";c.d(b,{d:()=>g,r:()=>h});var d=c(77598),e=c(27143);function f(){let a=process.env.AUTH_SECRET;if(!a)throw Error("AUTH_SECRET is required to protect Google Calendar credentials.");return(0,d.createHash)("sha256").update(a).digest()}function g(a,b){let c=(0,d.randomBytes)(12),g=(0,d.createCipheriv)("aes-256-gcm",f(),c),h=Buffer.concat([g.update(b,"utf8"),g.final()]),i=[c.toString("hex"),g.getAuthTag().toString("hex"),h.toString("hex")].join(":");e.A.prepare(`
    INSERT INTO google_credentials (google_id, encrypted_refresh_token, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(google_id) DO UPDATE SET
      encrypted_refresh_token = excluded.encrypted_refresh_token,
      updated_at = CURRENT_TIMESTAMP
  `).run(a,i)}async function h(a){let b=process.env.AUTH_GOOGLE_ID,c=process.env.AUTH_GOOGLE_SECRET;if(!b||!c)throw Error("AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are required for Calendar access.");let h=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:b,client_secret:c,refresh_token:function(a){let b=e.A.prepare("SELECT encrypted_refresh_token FROM google_credentials WHERE google_id = ?").get(a);if(!b)throw Error("Google Calendar is not connected. Sign out and sign in again to grant Calendar access.");let[c,g,h]=b.encrypted_refresh_token.split(":");if(!c||!g||!h)throw Error("Stored Google Calendar credentials are invalid.");try{let a=(0,d.createDecipheriv)("aes-256-gcm",f(),Buffer.from(c,"hex"));return a.setAuthTag(Buffer.from(g,"hex")),Buffer.concat([a.update(Buffer.from(h,"hex")),a.final()]).toString("utf8")}catch{throw Error("Could not decrypt Google Calendar credentials. Check AUTH_SECRET and sign in again.")}}(a),grant_type:"refresh_token"})}),i=await h.json();if(!h.ok)throw Error("object"==typeof i&&null!==i&&"error_description"in i&&"string"==typeof i.error_description?i.error_description:`Google token refresh failed (${h.status}).`);if("object"!=typeof i||null===i||!("access_token"in i)||"string"!=typeof i.access_token)throw Error("Google returned an invalid token response.");return"refresh_token"in i&&"string"==typeof i.refresh_token&&g(a,i.refresh_token),i.access_token}},73024:a=>{"use strict";a.exports=require("node:fs")},76760:a=>{"use strict";a.exports=require("node:path")},77598:a=>{"use strict";a.exports=require("node:crypto")},78335:()=>{},86439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")},87550:a=>{"use strict";a.exports=require("better-sqlite3")},95736:(a,b,c)=>{"use strict";a.exports=c(44870)},95783:(a,b,c)=>{"use strict";c.r(b),c.d(b,{handler:()=>G,patchFetch:()=>F,routeModule:()=>B,serverHooks:()=>E,workAsyncStorage:()=>C,workUnitAsyncStorage:()=>D});var d={};c.r(d),c.d(d,{DELETE:()=>A,PATCH:()=>z});var e=c(95736),f=c(9117),g=c(4044),h=c(39326),i=c(32324),j=c(261),k=c(54290),l=c(85328),m=c(38928),n=c(46595),o=c(3421),p=c(17679),q=c(41681),r=c(63446),s=c(86439),t=c(34679),u=c(51356),v=c(10641),w=c(45470),x=c(27143);function y(a){let b=Number(a);return Number.isSafeInteger(b)&&b>0?b:null}async function z(a,b){let c,d=await (0,w.E)();if(!d)return v.NextResponse.json({error:"Sign in to update scheduled jobs."},{status:401});let e=y((await b.params).id);if(null===e)return v.NextResponse.json({error:"Invalid scheduled job id."},{status:400});try{c=await a.json()}catch{return v.NextResponse.json({error:"Request body must be valid JSON."},{status:400})}return"object"==typeof c&&null!==c&&"enabled"in c&&"boolean"==typeof c.enabled?1!==x.A.prepare("UPDATE scheduled_jobs SET enabled = ? WHERE id = ? AND owner_id = ?").run(+!!c.enabled,e,d).changes?v.NextResponse.json({error:"Scheduled job not found."},{status:404}):v.NextResponse.json({success:!0}):v.NextResponse.json({error:"Provide an enabled boolean."},{status:400})}async function A(a,b){let c=await (0,w.E)();if(!c)return v.NextResponse.json({error:"Sign in to delete scheduled jobs."},{status:401});let d=y((await b.params).id);return null===d?v.NextResponse.json({error:"Invalid scheduled job id."},{status:400}):1!==x.A.prepare("DELETE FROM scheduled_jobs WHERE id = ? AND owner_id = ?").run(d,c).changes?v.NextResponse.json({error:"Scheduled job not found."},{status:404}):v.NextResponse.json({success:!0})}let B=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/schedules/[id]/route",pathname:"/api/schedules/[id]",filename:"route",bundlePath:"app/api/schedules/[id]/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"C:\\Users\\Dell\\Downloads\\agent-city\\agent-city\\app\\api\\schedules\\[id]\\route.ts",nextConfigOutput:"",userland:d}),{workAsyncStorage:C,workUnitAsyncStorage:D,serverHooks:E}=B;function F(){return(0,g.patchFetch)({workAsyncStorage:C,workUnitAsyncStorage:D})}async function G(a,b,c){var d;let e="/api/schedules/[id]/route";"/index"===e&&(e="/");let g=await B.prepare(a,b,{srcPage:e,multiZoneDraftMode:!1});if(!g)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:v,params:w,nextConfig:x,isDraftMode:y,prerenderManifest:z,routerServerContext:A,isOnDemandRevalidate:C,revalidateOnlyGenerated:D,resolvedPathname:E}=g,F=(0,j.normalizeAppPath)(e),G=!!z.routes[E]&&(B.isDev||(0,t.isRouteCacheOwner)(E,B.cacheOwner,z.routes[E])),H=!!(z.dynamicRoutes[F]||G);if(H&&!y){let a=z.dynamicRoutes[F];if(a&&!1===a.fallback&&!G)throw new s.NoFallbackError}let I=null;!H||B.isDev||y||(I="/index"===(I=E)?"/":I);let J=!0===B.isDev||!H,K=H&&!J,L=a.method||"GET",M=(0,i.getTracer)(),N=M.getActiveScopeSpan(),O={params:w,prerenderManifest:z,renderOpts:{experimental:{cacheComponents:!!x.experimental.cacheComponents,authInterrupts:!!x.experimental.authInterrupts},supportsDynamicResponse:J,incrementalCache:(0,h.getRequestMeta)(a,"incrementalCache"),cacheLifeProfiles:null==(d=x.experimental)?void 0:d.cacheLife,isRevalidate:K,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d)=>B.onRequestError(a,b,d,A)},sharedContext:{buildId:v}},P=new k.NodeNextRequest(a),Q=new k.NodeNextResponse(b),R=l.NextRequestAdapter.fromNodeNextRequest(P,(0,l.signalFromNodeResponse)(b));try{let d=async c=>B.handle(R,O).finally(()=>{if(!c)return;c.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let d=M.getRootSpanAttributes();if(!d)return;if(d.get("next.span_type")!==m.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${d.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let e=d.get("next.route");if(e){let a=`${L} ${e}`;c.setAttributes({"next.route":e,"http.route":e,"next.span_name":a}),c.updateName(a)}else c.updateName(`${L} ${a.url}`)}),g=async g=>{var i,j;let k=async({previousCacheEntry:f})=>{try{if(!(0,h.getRequestMeta)(a,"minimalMode")&&C&&D&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let e=await d(g);a.fetchMetrics=O.renderOpts.fetchMetrics;let i=O.renderOpts.pendingWaitUntil;i&&c.waitUntil&&(c.waitUntil(i),i=void 0);let j=O.renderOpts.collectedTags;if(!H)return await (0,o.I)(P,Q,e,O.renderOpts.pendingWaitUntil),null;{let a=await e.blob(),b=(0,p.toNodeOutgoingHttpHeaders)(e.headers);j&&(b[r.NEXT_CACHE_TAGS_HEADER]=j),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==O.renderOpts.collectedRevalidate&&!(O.renderOpts.collectedRevalidate>=r.INFINITE_CACHE)&&O.renderOpts.collectedRevalidate,d=void 0===O.renderOpts.collectedExpire||O.renderOpts.collectedExpire>=r.INFINITE_CACHE?void 0:O.renderOpts.collectedExpire;return{value:{kind:u.CachedRouteKind.APP_ROUTE,status:e.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:d}}}}catch(b){throw(null==f?void 0:f.isStale)&&await B.onRequestError(a,b,{routerKind:"App Router",routePath:e,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:K,isOnDemandRevalidate:C})},A),b}},l=await B.handleResponse({req:a,nextConfig:x,cacheKey:I,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:z,isRoutePPREnabled:!1,isOnDemandRevalidate:C,revalidateOnlyGenerated:D,responseGenerator:k,waitUntil:c.waitUntil});if(!H)return null;if((null==l||null==(i=l.value)?void 0:i.kind)!==u.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(j=l.value)?void 0:j.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});(0,h.getRequestMeta)(a,"minimalMode")||b.setHeader("x-nextjs-cache",C?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),y&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let m=(0,p.fromNodeOutgoingHttpHeaders)(l.value.headers);return(0,h.getRequestMeta)(a,"minimalMode")&&H||m.delete(r.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||b.getHeader("Cache-Control")||m.get("Cache-Control")||m.set("Cache-Control",(0,q.getCacheControlHeader)(l.cacheControl)),await (0,o.I)(P,Q,new Response(l.value.body,{headers:m,status:l.value.status||200})),null};N?await g(N):await M.withPropagatedContext(a.headers,()=>M.trace(m.BaseServerSpan.handleRequest,{spanName:`${L} ${a.url}`,kind:i.SpanKind.SERVER,attributes:{"http.method":L,"http.target":a.url}},g))}catch(b){if(b instanceof s.NoFallbackError||await B.onRequestError(a,b,{routerKind:"App Router",routePath:F,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:K,isOnDemandRevalidate:C})}),H)throw b;return await (0,o.I)(P,Q,new Response(null,{status:500})),null}}},96487:()=>{}};var b=require("../../../../webpack-runtime.js");b.C(a);var c=b.X(0,[897,641,918,667,528],()=>b(b.s=95783));module.exports=c})();