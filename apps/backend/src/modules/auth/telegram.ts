import {constantTimeEqual,encoder} from "../../shared/crypto";
export type TelegramUser={id:number;first_name:string;last_name?:string;username?:string;language_code?:string};
export function telegramDataCheckString(p:URLSearchParams):string{return [...p.entries()].filter(([k])=>k!=="hash").sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join("\n");}
export async function verifyTelegramInitData(data:string,token:string,maxAge=86400,now=Math.floor(Date.now()/1000)) {
 if(!data||data.length>16384)return null;const p=new URLSearchParams(data),hash=p.get("hash"),rawDate=p.get("auth_date"),rawUser=p.get("user");
 if(!hash||!/^[a-f0-9]{64}$/i.test(hash)||!rawDate||!rawUser)return null;const authDate=Number(rawDate);
 if(!Number.isSafeInteger(authDate)||authDate>now+60||now-authDate>maxAge)return null;
 let user:TelegramUser;try{user=JSON.parse(rawUser) as TelegramUser;}catch{return null;}
 if(!Number.isSafeInteger(user.id)||user.id<=0||typeof user.first_name!=="string")return null;
 const k=await crypto.subtle.importKey("raw",encoder.encode("WebAppData"),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const secret=await crypto.subtle.sign("HMAC",k,encoder.encode(token));
 const dk=await crypto.subtle.importKey("raw",secret,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const digest=new Uint8Array(await crypto.subtle.sign("HMAC",dk,encoder.encode(telegramDataCheckString(p))));
 const expected=[...digest].map(x=>x.toString(16).padStart(2,"0")).join("");
 return constantTimeEqual(expected.toLowerCase(),hash.toLowerCase())?{user,authDate}:null;
}