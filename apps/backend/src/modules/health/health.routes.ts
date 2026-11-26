import {Hono} from "hono";import type {AppEnv} from "../../types/env";
export const healthRoutes=new Hono<AppEnv>();
healthRoutes.get("/live",c=>c.json({data:{status:"ok",service:"englishcodeapp-api"}}));
healthRoutes.get("/ready",async c=>{try{await c.env.DB.prepare("SELECT 1").first();return c.json({data:{status:"ready",database:"reachable"}});}catch{return c.json({error:{code:"DEPENDENCY_UNAVAILABLE",message:"Database is unavailable."}},503);}});