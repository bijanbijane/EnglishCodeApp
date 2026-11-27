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

function unknownSizeElement(id: number, payload: Uint8Array): Uint8Array {
  const length = id <= 0xff ? 1 : id <= 0xffff ? 2 : id <= 0xffffff ? 3 : 4;
  const idBytes = new Uint8Array(length);
  let value = id;
  for (let index = length - 1; index >= 0; index -= 1) {
    idBytes[index] = value & 0xff;
    value = Math.floor(value / 256);
  }
  return concatBytes(idBytes, new Uint8Array([0xff]), payload);
}

function uint(value: number): Uint8Array {
  const bytes: number[] = [];
  do {
    bytes.unshift(value & 0xff);
    value = Math.floor(value / 256);
  } while (value > 0);
  return new Uint8Array(bytes);
}

function webm(blocks: Uint8Array[], unknownSegment = false, unknownCluster = false): Uint8Array {
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
  const clusterPayload = concatBytes(
    element(0xe7, uint(0)),
    ...blocks.map((block) => element(0xa3, block)),
  );
  const cluster = unknownCluster
    ? unknownSizeElement(0x1f43b675, clusterPayload)
    : element(0x1f43b675, clusterPayload);
  const segmentPayload = concatBytes(info, tracks, cluster);
  const segment = unknownSegment
    ? unknownSizeElement(0x18538067, segmentPayload)
    : element(0x18538067, segmentPayload);
  return concatBytes(header, segment);
}

function block(flags: number, lacingHeader: Uint8Array, payload: Uint8Array): Uint8Array {
  return concatBytes(new Uint8Array([0x81, 0, 0, flags]), lacingHeader, payload);
}

const opusPacket = new Uint8Array([0x98, 0x00]);

// One-second synthetic WebM/Opus file produced by FFmpeg 7.1.5 (libopus, 24 kbit/s).
const ffmpegWebmFixtureBase64 = "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";

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

  it("parses MediaRecorder-style unknown-size Segment and Cluster elements", () => {
    const singleBlock = block(0, new Uint8Array(), opusPacket);
    expect(getWebmOpusDurationSeconds(webm([singleBlock], true, true))).toBeCloseTo(0.02, 6);
  });

  it("parses a real FFmpeg WebM/Opus recording with an Info Duration element and BlockGroup tail", () => {
    const binary = atob(ffmpegWebmFixtureBase64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const duration = getWebmOpusDurationSeconds(bytes);

    expect(bytes.length).toBe(4412);
    expect(duration).toBeGreaterThan(0.99);
    expect(duration).toBeLessThan(1.03);
  });

  it("fails closed on truncated or unsupported containers", () => {
    expect(() => getWebmOpusDurationSeconds(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]))).toThrow();
    expect(() => getWebmOpusDurationSeconds(new Uint8Array(40))).toThrow();
  });
});
