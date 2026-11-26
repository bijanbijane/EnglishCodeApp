import {describe,expect,it} from "vitest";import {telegramDataCheckString,verifyTelegramInitData} from "../src/modules/auth/telegram";
describe("Telegram Mini App validation",()=>{
 it("sorts fields and excludes hash",()=>{const p=new URLSearchParams("query_id=q&auth_date=100&hash=ignored&user=%7B%7D");expect(telegramDataCheckString(p)).toBe("auth_date=100\nquery_id=q\nuser={}");});
 it("rejects malformed and expired payloads",async()=>{expect(await verifyTelegramInitData("","token")).toBeNull();expect(await verifyTelegramInitData("auth_date=1&user=%7B%7D&hash=bad","token")).toBeNull();const u=encodeURIComponent(JSON.stringify({id:1,first_name:"A"}));expect(await verifyTelegramInitData(`auth_date=1&user=${u}&hash=${"0".repeat(64)}`,"token",60,1000)).toBeNull();});
});