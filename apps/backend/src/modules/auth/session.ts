import {fromBase64Url,toBase64Url,encoder} from "../../shared/crypto";
type Claims={sub:string;iat:number;exp:number;iss:"englishcodeapp"};
export async function createSessionToken(userId:string,secret:string,ttl=3600,now=Math.floor(Date.now()/1000)):Promise<string>{
 const h=toBase64Url(encoder.encode(JSON.stringify({alg:"HS256",typ:"JWT"})));
 const p=toBase64Url(encoder.encode(JSON.stringify({sub:userId,iat:now,exp:now+ttl,iss:"englishcodeapp"} satisfies Claims)));
 const input=`${h}.${p}`,key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const sig=new Uint8Array(await crypto.subtle.sign("HMAC",key,encoder.encode(input)));return `${input}.${toBase64Url(sig)}`;
}
export async function verifySessionToken(token:string,secret:string,now=Math.floor(Date.now()/1000)):Promise<string|null>{
 const parts=token.split(".");if(parts.length!==3)return null;const [h,p,s]=parts as [string,string,string];
 try{const head=JSON.parse(new TextDecoder().decode(fromBase64Url(h))) as {alg?:string;typ?:string};if(head.alg!=="HS256"||head.typ!=="JWT")return null;
 const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
 if(!await crypto.subtle.verify("HMAC",key,fromBase64Url(s),encoder.encode(`${h}.${p}`)))return null;
 const c=JSON.parse(new TextDecoder().decode(fromBase64Url(p))) as Claims;return c.iss==="englishcodeapp"&&!!c.sub&&Number.isInteger(c.exp)&&c.exp>now?c.sub:null;
 }catch{return null;}
}