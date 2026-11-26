import {Hono} from "hono";import type {AppEnv} from "../../types/env";import {AppError} from "../../shared/errors";
export const lessonRoutes=new Hono<AppEnv>();
lessonRoutes.get("/",async c=>{
 const raw=Number(c.req.query("limit")??20),limit=Math.min(Math.max(Number.isFinite(raw)?raw:20,1),50),cursor=c.req.query("cursor")??null;
 const r=await c.env.DB.prepare(`SELECT id,course_id AS courseId,title,description,level,position,version FROM lessons WHERE status='published' AND (? IS NULL OR id>?) ORDER BY id LIMIT ?`).bind(cursor,cursor,limit+1).all<{id:string;courseId:string;title:string;description:string|null;level:string;position:number;version:number}>();
 const rows=r.results??[],more=rows.length>limit,items=more?rows.slice(0,limit):rows;return c.json({data:items,page:{limit,nextCursor:more?items.at(-1)?.id??null:null}});
});
lessonRoutes.get("/:lessonId",async c=>{
 const id=c.req.param("lessonId"),lesson=await c.env.DB.prepare("SELECT id,course_id AS courseId,title,description,level,position,version FROM lessons WHERE id=? AND status='published'").bind(id).first();
 if(!lesson)throw new AppError("LESSON_NOT_FOUND","درس پیدا نشد.",404);
 const q=await c.env.DB.prepare("SELECT id,type,prompt,options_json AS options,position FROM questions WHERE lesson_id=? AND status='published' ORDER BY position").bind(id).all();
 return c.json({data:{...lesson,questions:q.results??[]}});
});