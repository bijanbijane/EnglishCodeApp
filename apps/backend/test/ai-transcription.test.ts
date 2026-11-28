import { describe, expect, it, vi } from "vitest";
import app from "../src/app";
import { createSessionToken } from "../src/modules/auth/session";
import { cleanupExpiredAuthState } from "../src/modules/maintenance/cleanup";

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function encodeSizeVint(value: number): Uint8Array {
  for (let length = 1; length <= 8; length += 1) {
    const marker = 2 ** (7 * length);
    if (value < marker - 1) {
      const encoded = value + marker;
      const result = new Uint8Array(length);
      let current = encoded;
      for (let index = length - 1; index >= 0; index -= 1) {
        result[index] = current & 0xff;
        current = Math.floor(current / 256);
      }
      return result;
    }
  }
  throw new Error("Fixture element is too large.");
}

function ebmlElement(id: number, data: Uint8Array): Uint8Array {
  const idLength = id <= 0xff ? 1 : id <= 0xffff ? 2 : id <= 0xffffff ? 3 : 4;
  const idBytes = new Uint8Array(idLength);
  let current = id;
  for (let index = idLength - 1; index >= 0; index -= 1) {
    idBytes[index] = current & 0xff;
    current = Math.floor(current / 256);
  }
  return concatBytes(idBytes, encodeSizeVint(data.length), data);
}

function unsigned(value: number): Uint8Array {
  if (value === 0) return new Uint8Array([0]);
  const bytes: number[] = [];
  let current = value;
  while (current > 0) {
    bytes.unshift(current & 0xff);
    current = Math.floor(current / 256);
  }
  return new Uint8Array(bytes);
}

function textBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function opusHead(): Uint8Array {
  const header = new Uint8Array(19);
  header.set(textBytes("OpusHead"), 0);
  header[8] = 1;
  header[9] = 1;
  header[12] = 0x80;
  header[13] = 0xbb;
  return header;
}

function opusPacket(): Uint8Array {
  // CELT 20 ms, one frame per Opus packet.
  return new Uint8Array([0x98, 0x00]);
}

function makeSimpleBlock(relativeTimestamp: number): Uint8Array {
  const timestamp = new Uint8Array([
    (relativeTimestamp >> 8) & 0xff,
    relativeTimestamp & 0xff,
  ]);
  return concatBytes(new Uint8Array([0x81]), timestamp, new Uint8Array([0]), opusPacket());
}

function makeWebm(clusters: Array<{ timecode: number; relativeTimestamps: number[] }>): Uint8Array {
  const header = ebmlElement(
    0x1a45dfa3,
    ebmlElement(0x4282, textBytes("webm")),
  );
  const info = ebmlElement(
    0x1549a966,
    ebmlElement(0x2ad7b1, unsigned(1_000_000)),
  );
  const trackEntry = ebmlElement(
    0xae,
    concatBytes(
      ebmlElement(0xd7, unsigned(1)),
      ebmlElement(0x83, unsigned(2)),
      ebmlElement(0x86, textBytes("A_OPUS")),
      ebmlElement(0x63a2, opusHead()),
    ),
  );
  const tracks = ebmlElement(0x1654ae6b, trackEntry);
  const clusterElements = clusters.map(({ timecode, relativeTimestamps }) =>
    ebmlElement(
      0x1f43b675,
      concatBytes(
        ebmlElement(0xe7, unsigned(timecode)),
        ...relativeTimestamps.map(makeSimpleBlock).map((block) => ebmlElement(0xa3, block)),
      ),
    ),
  );
  return concatBytes(
    header,
    ebmlElement(0x18538067, concatBytes(info, tracks, ...clusterElements)),
  );
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function makeDb(quotaGranted = true) {
  const statements: string[] = [];
  const db = {
    prepare: vi.fn((sql: string) => {
      statements.push(sql);
      return {
        bind: vi.fn(() => ({
          first: vi.fn().mockResolvedValue(
            sql.includes("FROM sessions")
              ? { id: "session-1", user_id: "user-1" }
              : null,
          ),
          run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
        })),
      };
    }),
    batch: vi.fn().mockResolvedValue([
      { meta: { changes: 1 } },
      { meta: { changes: quotaGranted ? 1 : 0 } },
      { meta: { changes: quotaGranted ? 0 : 1 } },
    ]),
  };
  return { db, statements };
}

const validPayload = {
  audioBase64: toBase64(makeWebm([{ timecode: 0, relativeTimestamps: [0] }])),
  mimeType: "audio/webm;codecs=opus",
};

describe("AI speech transcription API", () => {
  it("requires an authenticated session before transcription", async () => {
    const { db } = makeDb();
    const AI = { run: vi.fn() };
    const response = await app.request(
      "/api/v1/ai/transcriptions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
      },
      { DB: db, AI } as never,
    );

    expect(response.status).toBe(401);
    expect(AI.run).not.toHaveBeenCalled();
    expect(db.batch).not.toHaveBeenCalled();
  });

  it("authenticates before applying the larger transcription body limit", async () => {
    const { db } = makeDb();
    const response = await app.request(
      "/api/v1/ai/transcriptions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "x".repeat(300 * 1024),
      },
      { DB: db, AI: { run: vi.fn() } } as never,
    );

    expect(response.status).toBe(401);
    expect(db.batch).not.toHaveBeenCalled();
  });

  it("rejects malformed base64 without consuming quota", async () => {
    const token = await createSessionToken();
    const { db } = makeDb();
    const response = await app.request(
      "/api/v1/ai/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...validPayload, audioBase64: "%%%not-base64%%%" }),
      },
      { DB: db, AI: { run: vi.fn() } } as never,
    );

    expect(response.status).toBe(400);
    expect(db.batch).not.toHaveBeenCalled();
  });

  it("rejects audio larger than 1 MiB without consuming quota", async () => {
    const token = await createSessionToken();
    const { db } = makeDb();
    const oversizedAudio = btoa("x".repeat(1024 * 1024 + 1));
    const response = await app.request(
      "/api/v1/ai/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...validPayload, audioBase64: oversizedAudio }),
      },
      { DB: db, AI: { run: vi.fn() } } as never,
    );

    expect(response.status).toBe(413);
    expect(db.batch).not.toHaveBeenCalled();
  });

  it("rejects formats other than WebM/Opus without consuming quota", async () => {
    const token = await createSessionToken();
    const { db } = makeDb();
    const response = await app.request(
      "/api/v1/ai/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...validPayload, mimeType: "audio/ogg" }),
      },
      { DB: db, AI: { run: vi.fn() } } as never,
    );

    expect(response.status).toBe(400);
    expect(db.batch).not.toHaveBeenCalled();
  });

  it("rejects malformed WebM containers before consuming quota", async () => {
    const token = await createSessionToken();
    const { db } = makeDb();
    const response = await app.request(
      "/api/v1/ai/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...validPayload, audioBase64: toBase64(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])) }),
      },
      { DB: db, AI: { run: vi.fn() } } as never,
    );

    expect(response.status).toBe(400);
    expect(db.batch).not.toHaveBeenCalled();
  });

  it("rejects recordings longer than 60 seconds using container timestamps, not client claims", async () => {
    const token = await createSessionToken();
    const { db } = makeDb();
    const tooLong = makeWebm([
      { timecode: 0, relativeTimestamps: [0] },
      { timecode: 60_000, relativeTimestamps: [0] },
    ]);
    const response = await app.request(
      "/api/v1/ai/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...validPayload,
          audioBase64: toBase64(tooLong),
          durationSeconds: 1,
        }),
      },
      { DB: db, AI: { run: vi.fn() } } as never,
    );

    expect(response.status).toBe(400);
    expect(db.batch).not.toHaveBeenCalled();
  });

  it("returns the transcription and the server-measured duration on success", async () => {
    const token = await createSessionToken();
    const { db } = makeDb();
    const AI = {
      run: vi.fn().mockResolvedValue({
        text: "Good morning",
        word_count: 2,
        transcription_info: { language: "en" },
      }),
    };
    const response = await app.request(
      "/api/v1/ai/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...validPayload, durationSeconds: 59 }),
      },
      { DB: db, AI } as never,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: {
        transcription: "Good morning",
        wordCount: 2,
        language: "en",
        durationSeconds: 0.02,
      },
      meta: { quota: { userDailyLimit: 2, globalDailyLimit: 60 } },
    });
    expect(AI.run).toHaveBeenCalledOnce();
    expect(db.batch).toHaveBeenCalledOnce();
  });

  it("returns 429 when the user quota reservation cannot be created", async () => {
    const token = await createSessionToken();
    const { db } = makeDb(false);
    const AI = { run: vi.fn() };
    const response = await app.request(
      "/api/v1/ai/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validPayload),
      },
      { DB: db, AI } as never,
    );

    expect(response.status).toBe(429);
    expect(AI.run).not.toHaveBeenCalled();
  });

  it("retains quota reservations when Workers AI fails to prevent retry abuse", async () => {
    const token = await createSessionToken();
    const { db } = makeDb();
    const AI = { run: vi.fn().mockRejectedValue(new Error("upstream unavailable")) };
    const response = await app.request(
      "/api/v1/ai/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validPayload),
      },
      { DB: db, AI } as never,
    );

    expect(response.status).toBe(503);
    expect(db.prepare.mock.calls.some(([sql]) => sql.includes("DELETE FROM ai_transcription_reservations WHERE id IN"))).toBe(false);
  });
});

describe("AI quota maintenance", () => {
  it("prunes at most 500 expired reservations while retaining seven days", async () => {
    const prepared: Array<{ sql: string; bound: unknown[] }> = [];
    const db = {
      prepare: vi.fn((sql: string) => ({
        bind: vi.fn((...values: unknown[]) => {
          prepared.push({ sql, bound: values });
          return { run: vi.fn() };
        }),
      })),
      batch: vi.fn().mockResolvedValue([]),
    };
    await cleanupExpiredAuthState(db as never, new Date("2026-11-27T12:00:00.000Z"));

    expect(db.batch).toHaveBeenCalledOnce();
    expect(prepared).toHaveLength(5);
    expect(prepared[4].sql).toContain("DELETE FROM ai_transcription_reservations");
    expect(prepared[4].sql).toContain("LIMIT 500");
    expect(prepared[4].bound).toEqual(["2026-11-20"]);
  });
});
