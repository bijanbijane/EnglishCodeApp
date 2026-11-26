import {Hono} from "hono";
import {z} from "zod";
import type {AppEnv} from "../../types/env";
import {AppError} from "../../shared/errors";
import {verifyTelegramInitData} from "./telegram";
import {createSessionToken} from "./session";

const schema=z.object({initData:z.string().min(1).max(16384)});
export const authRoutes=new Hono<AppEnv>();

authRoutes.post("/telegram",async c=>{
 const body=schema.safeParse(await c.req.json().catch(()=>null));
 if(!body.success)throw new AppError("INVALID_REQUEST","درخواست ورود معتبر نیست.",400);
 const {TELEGRAM_BOT_TOKEN,SESSION_SECRET,DB,TELEGRAM_MAX_AUTH_AGE_SECONDS}=c.env;
 if(!TELEGRAM_BOT_TOKEN||!SESSION_SECRET)throw new AppError("AUTH_NOT_CONFIGURED","ورود تلگرام پیکربندی نشده است.",503);
 if(new TextEncoder().encode(SESSION_SECRET).length<32)throw new AppError("WEAK_SESSION_SECRET","کلید نشست باید حداقل ۳۲ بایت باشد.",500);
 const maxAge=Number(TELEGRAM_MAX_AUTH_AGE_SECONDS??86400);
 if(!Number.isSafeInteger(maxAge)||maxAge<60||maxAge>86400)throw new AppError("INVALID_AUTH_CONFIG","تنظیمات اعتبار ورود نامعتبر است.",500);
 const identity=await verifyTelegramInitData(body.data.initData,TELEGRAM_BOT_TOKEN,maxAge);
 if(!identity)throw new AppError("INVALID_TELEGRAM_INIT_DATA","اطلاعات ورود تلگرام معتبر یا تازه نیست.",401);
 const initHash=new URLSearchParams(body.data.initData).get("hash");
 if(!initHash)throw new AppError("INVALID_TELEGRAM_INIT_DATA","هش ورود وجود ندارد.",401);
 const now=Math.floor(Date.now()/1000);
 await DB.prepare("DELETE FROM telegram_auth_replays WHERE expires_at < ?").bind(now).run();
 const replay=await DB.prepare("INSERT INTO telegram_auth_replays(init_data_hash,expires_at) VALUES(?,?) ON CONFLICT(init_data_hash) DO NOTHING")
  .bind(initHash,identity.authDate+maxAge).run();
 if((replay.meta.changes??0)===0)throw new AppError("TELEGRAM_INIT_DATA_REPLAYED","این دادهٔ ورود قبلاً استفاده شده است.",409);
 await DB.prepare(`INSERT INTO users(id,telegram_user_id,display_name,username,created_at,updated_at) VALUES(?,?,?,?,datetime('now'),datetime('now'))
 ON CONFLICT(telegram_user_id) DO UPDATE SET display_name=excluded.display_name,username=excluded.username,updated_at=datetime('now')`)
 .bind(crypto.randomUUID(),String(identity.user.id),identity.user.first_name,identity.user.username??null).run();
 const user=await DB.prepare("SELECT id FROM users WHERE telegram_user_id=?").bind(String(identity.user.id)).first<{id:string}>();
 if(!user)throw new AppError("USER_PERSISTENCE_FAILED","ساخت حساب کاربر انجام نشد.",500);
 return c.json({data:{accessToken:await createSessionToken(user.id,SESSION_SECRET),tokenType:"Bearer",expiresIn:3600}});
});