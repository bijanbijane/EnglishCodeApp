import {describe,expect,it} from "vitest";
import {telegramDataCheckString,verifyTelegramInitData} from "../src/modules/auth/telegram";

async function signedInitData(botToken:string,authDate:number):Promise<string>{
 const params=new URLSearchParams({
  auth_date:String(authDate),
  query_id:"test-query",
  user:JSON.stringify({id:12345,first_name:"Test",username:"test_user"})
 });
 const encoder=new TextEncoder();
 const secretKey=await crypto.subtle.importKey("raw",encoder.encode("WebAppData"),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const secret=await crypto.subtle.sign("HMAC",secretKey,encoder.encode(botToken));
 const dataKey=await crypto.subtle.importKey("raw",secret,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const digest=new Uint8Array(await crypto.subtle.sign("HMAC",dataKey,encoder.encode(telegramDataCheckString(params))));
 params.set("hash",[...digest].map(x=>x.toString(16).padStart(2,"0")).join(""));
 return params.toString();
}

describe("Telegram Mini App validation",()=>{
 it("sorts fields and excludes hash",()=>{
  const p=new URLSearchParams("query_id=q&auth_date=100&hash=ignored&user=%7B%7D");
  expect(telegramDataCheckString(p)).toBe("auth_date=100\nquery_id=q\nuser={}");
 });
 it("accepts a valid signature and returns the Telegram identity",async()=>{
  const data=await signedInitData("test-bot-token",1000);
  await expect(verifyTelegramInitData(data,"test-bot-token",300,1100)).resolves.toMatchObject({
   user:{id:12345,first_name:"Test",username:"test_user"},authDate:1000
  });
 });
 it("rejects malformed, forged and expired payloads",async()=>{
  expect(await verifyTelegramInitData("","token")).toBeNull();
  expect(await verifyTelegramInitData("auth_date=1&user=%7B%7D&hash=bad","token")).toBeNull();
  const data=await signedInitData("test-bot-token",1000);
  expect(await verifyTelegramInitData(data,"wrong-token",300,1100)).toBeNull();
  expect(await verifyTelegramInitData(data,"test-bot-token",60,1100)).toBeNull();
 });
});