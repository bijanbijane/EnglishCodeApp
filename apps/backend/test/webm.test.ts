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

// One-second WebM/Opus recording produced by FFmpeg 7.1.5 (libopus, 24 kbit/s).
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

    expect(bytes.length).toBe(4788);
    expect(duration).toBeGreaterThan(0.99);
    expect(duration).toBeLessThan(1.03);
  });

  it("fails closed on truncated or unsupported containers", () => {
    expect(() => getWebmOpusDurationSeconds(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]))).toThrow();
    expect(() => getWebmOpusDurationSeconds(new Uint8Array(40))).toThrow();
  });
});
