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
const ffmpegWebmFixtureBase64 = "GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwEAAAAAAATLEU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHWTbuMU6uEElTDZ1OsggFATbuMU6uEHFO7a1OsggS17AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmsCrXsYMPQkBNgIxMYXZmNjEuNy4xMDNXQYxMYXZmNjEuNy4xMDNEiYhAagAAAAAAABZUrmvlrgEAAAAAAABc14EBc8WILd4qf2EsSwacgQAitZyDdW5kiIEAhoZBX09QVVNWqoNjLqBWu4QExLQAg4EC4ZGfgQG1iEDncAAAAAAAYmSBEGOik09wdXNIZWFkAQE4AYC7AAAAAAASVMNn/HNzn2PAgGfImUWjh0VOQ09ERVJEh4xMYXZmNjEuNy4xMDNzc9djwItjxYgt3ip/YSxLBmfIokWjh0VOQ09ERVJEh5VMYXZjNjEuMTkuMTAxIGxpYm9wdXNnyKFFo4hEVVJBVElPTkSHkzAwOjAwOjAwLjIwODAwMDAwMAAfQ7Z1Qu7ngQCj44EAAIB4gaddbJ6ZrAAABn5WOfc9Uk4I1EBu2pzCWqlyFXGB9cPe2wBGZEO5LW0A+vQWeiwiW+g+lFBLKmcxuYJdLLeHN6KbrmvRmSy5OpVre4uzYw/NBMixOLLIX9SA2IYsRaPGgQAVgHifZwHn/JVNTqi+4Hu9aFy0B7wm6zN7TM1HVMFOdtmNqyaj0sHbBxvFpMli5QbdJQ3bkKGVSbMFI2qebUlPozub0KPAgQApgHiast91nPxLVRwRcvAwz0EjjQlnzHWbj9f88VTI/VK18UhuNR5nPKU1ySnpapLCaCmAmMJWUMziY/xDX6PCgQA9gHiast91nPxF72pKpHunfcGLr2vVw/RIjWDMw6DGgy7Ui/AkwY91FN2X2mOISxAwEXvexk2RvYhKjyu9BFdPo8qBAFGAeJqy33Wc/EWeW2sbptSmEN5sJzofeYCP7g+2DlgCYEWMXd5gpwaf2JkrGIsrPBAfRxdyIlpIy+iZjJtKITYz3IIo281tTaPCgQBlgHiast91mEqCv/fQAsE1R0Egip2OEJUNsw6wfZ0YwKdKjygVujRDVRRDhLwR1dL1M4YPfN5jzudLLo19VClgo72BAHmAeJqy33WYSnTQGaoStAqjhKVtELCf19NZ68rIPMkulnn4c9H1E+RAri1UY4wC1E3zTsnjRTubK0pNo8CBAI2AeJqykbOjvRURZiflOzeTxKD4X9CmxFKPfeN8bYslx5RhqDmURIHxT908k6IZ/Km9JFIBZGp5YrtLV69Wo8KBAKGAeJqy33Wc/ElKN6pDfxqJWTr38RocC88Z/EBjvaS+CyRASOZE1sbuoZqLEw6mk9rvlsSgBgiPfxB3AbmPSlijtIEAtYBImcJfcy3SMQ7GT0+VZNUKQOUEef85KXw4NDpHsOcOJYTshMpx8qbNCJIjkUnAVGCgq6GigQDJAEgFipc6Lv/tbXCyy5ubPkPqnbF8j9z2iYb8JGtFYHWihADN/mAcU7trkbuPs4EAt4r3gQHxggHB8IED";

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
    expect(duration).toBeGreaterThan(0.19);
    expect(duration).toBeLessThan(0.23);
  });

  it("fails closed on truncated or unsupported containers", () => {
    expect(() => getWebmOpusDurationSeconds(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]))).toThrow();
    expect(() => getWebmOpusDurationSeconds(new Uint8Array(40))).toThrow();
  });
});
