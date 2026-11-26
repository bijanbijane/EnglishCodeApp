import {Hono} from "hono";import {cors} from "hono/cors";import {secureHeaders} from "hono/secure-headers";import type {AppEnv} from "./types/env";import {AppError,errorResponse} from "./shared/errors";import {healthRoutes} from "./modules/health/health.routes";import {authRoutes} from "./modules/auth/auth.routes";import {lessonRoutes} from "./modules/lessons/lessons.routes";import {requireAuth} from "./middleware/auth";
export function createApp(){
 const app=new Hono<AppEnv>();
 app.use("*",async(c,next)=>{c.header("X-Request-Id",c.req.header("cf-ray")??crypto.randomUUID());await next();});
 app.use("*",secureHeaders());
 app.use("*",async(c,next)=>{const allowed=(c.env.ALLOWED_ORIGINS??"").split(",").map(x=>x.trim()).filter(Boolean);
 return cors({origin:o=>allowed.includes(o)?o:"",allowMethods:["GET","POST","OPTIONS"],allowHeaders:["Content-Type","Authorization"],maxAge:600})(c,next);});
 app.get("/",c=>c.json({data:{name:"EnglishCodeApp API",version:"v1"}}));app.route("/health",healthRoutes);
 app.route("/api/v1/auth",authRoutes);app.route("/api/v1/lessons",lessonRoutes);
 app.get("/api/v1/me",requireAuth,c=>c.json({data:{userId:c.get("userId")}}));
 app.notFound(c=>c.json({error:{code:"NOT_FOUND",message:"مسیر پیدا نشد."}},404));
 app.onError((e,c)=>{const id=c.res.headers.get("X-Request-Id")??"unavailable";
 if(e instanceof AppError)return c.json(errorResponse(e.code,e.message,id,e.status),e.status as 400);
 console.error(JSON.stringify({event:"unhandled_error",requestId:id,message:e.message}));
 return c.json(errorResponse("INTERNAL_ERROR","خطای داخلی سرور رخ داد.",id,500),500);});
 return app;
}