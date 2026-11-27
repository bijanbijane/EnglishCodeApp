import { describe, expect, it } from "vitest";
import { getWebmOpusDurationSeconds } from "../src/modules/ai/webm";

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
  throw new Error("Fixture is too large.");
}

function element(id: number, payload: Uint8Array): Uint8Array {
  const length = id <= 0xff ? 1 : id <= 0xffff ? 2 : id <= 0xffffff ? 3 : 4;
  const idBytes = new Uint8Array(length);
  let value = id;
  for (let index = length - 1; index >= 0; index -= 1) {
    idBytes[index] = value & 0xff;
    value = Math.floor(value / 256);
  }
  return concatBytes(idBytes, encodeSizeVint(payload.length), payload);
}

function uint(value: number): Uint8Array {
  const bytes: number[] = [];
  do {
    bytes.unshift(value & 0xff);
    value = Math.floor(value / 256);
  } while (value > 0);
  return new Uint8Array(bytes);
}

function webm(blocks: Uint8Array[]): Uint8Array {
  const text = (value: string) => new TextEncoder().encode(value);
  const opusHead = new Uint8Array(19);
  opusHead.set(text("OpusHead"));
  opusHead[8] = 1;
  opusHead[9] = 1;

  const header = element(0x1a45dfa3, element(0x4282, text("webm")));
  const info = element(0x1549a966, element(0x2ad7b1, uint(1_000_000)));
  const tracks = element(
    0x1654ae6b,
    element(
      0xae,
      concatBytes(
        element(0xd7, uint(1)),
        element(0x83, uint(2)),
        element(0x86, text("A_OPUS")),
        element(0x63a2, opusHead),
      ),
    ),
  );
  const cluster = element(
    0x1f43b675,
    concatBytes(element(0xe7, uint(0)), ...blocks.map((block) => element(0xa3, block))),
  );
  return concatBytes(header, element(0x18538067, concatBytes(info, tracks, cluster)));
}

function block(flags: number, lacingHeader: Uint8Array, payload: Uint8Array): Uint8Array {
  return concatBytes(new Uint8Array([0x81, 0, 0, flags]), lacingHeader, payload);
}

const opusPacket = new Uint8Array([0x98, 0x00]);

describe("WebM/Opus duration parser", () => {
  it("measures duration from packet timestamps and Opus TOC when the Info Duration field is absent", () => {
    const first = block(0, new Uint8Array(), opusPacket);
    const second = block(0, new Uint8Array(), opusPacket);
    // Relative timestamps are set to 0 and 20 ms in the Block headers.
    second[2] = 20;

    expect(getWebmOpusDurationSeconds(webm([first, second]))).toBeCloseTo(0.04, 6);
  });

  it("counts Xiph-laced Opus packets", () => {
    const xiphBlock = block(
      0x02,
      new Uint8Array([1, 2]),
      concatBytes(opusPacket, opusPacket),
    );
    expect(getWebmOpusDurationSeconds(webm([xiphBlock]))).toBeCloseTo(0.04, 6);
  });

  it("counts fixed-size-laced Opus packets", () => {
    const fixedBlock = block(
      0x04,
      new Uint8Array([1]),
      concatBytes(opusPacket, opusPacket),
    );
    expect(getWebmOpusDurationSeconds(webm([fixedBlock]))).toBeCloseTo(0.04, 6);
  });

  it("counts EBML-laced Opus packets", () => {
    const ebmlBlock = block(
      0x06,
      new Uint8Array([1, 0x82]),
      concatBytes(opusPacket, opusPacket),
    );
    expect(getWebmOpusDurationSeconds(webm([ebmlBlock]))).toBeCloseTo(0.04, 6);
  });

  it("fails closed on truncated or unsupported containers", () => {
    expect(() => getWebmOpusDurationSeconds(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]))).toThrow();
    expect(() => getWebmOpusDurationSeconds(new Uint8Array(40))).toThrow();
  });
});
