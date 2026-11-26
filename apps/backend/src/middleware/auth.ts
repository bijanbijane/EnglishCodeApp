import type {MiddlewareHandler} from "hono";import type {AppEnv} from "../types/env";import {verifySessionToken} from "../modules/auth/session";import {AppError} from "../shared/errors";
export const requireAuth:MiddlewareHandler<AppEnv>=async(c,next)=>{
 const secret=c.env.SESSION_SECRET;if(!secret)throw new AppError("AUTH_NOT_CONFIGURED","احراز هویت پیکربندی نشده است.",503);
 const match=/^Bearer ([A-Za-z0-9._-]+)$/.exec(c.req.header("Authorization")??"");if(!match)throw new AppError("UNAUTHENTICATED","برای دسترسی باید وارد شوید.",401);
 const id=await verifySessionToken(match[1]!,secret);if(!id)throw new AppError("INVALID_SESSION","نشست معتبر نیست یا منقضی شده است.",401);
 c.set("userId",id);await next();
};