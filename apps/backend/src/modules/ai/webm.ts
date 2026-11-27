const EBML_HEADER_ID = 0x1a45dfa3;
const EBML_DOCTYPE_ID = 0x4282;
const SEGMENT_ID = 0x18538067;
const INFO_ID = 0x1549a966;
const TIMECODE_SCALE_ID = 0x2ad7b1;
const TRACKS_ID = 0x1654ae6b;
const TRACK_ENTRY_ID = 0xae;
const TRACK_NUMBER_ID = 0xd7;
const TRACK_TYPE_ID = 0x83;
const CODEC_ID_ID = 0x86;
const CODEC_PRIVATE_ID = 0x63a2;
const TRACK_TIMESTAMP_SCALE_ID = 0x23314f;
const DEFAULT_DURATION_ID = 0x23e383;
const CLUSTER_ID = 0x1f43b675;
const CLUSTER_TIMECODE_ID = 0xe7;
const SIMPLE_BLOCK_ID = 0xa3;
const BLOCK_GROUP_ID = 0xa0;
const BLOCK_ID = 0xa1;
const BLOCK_DURATION_ID = 0x9b;
const NANOS_PER_SECOND = 1_000_000_000;

type EbmlElement = {
  id: number;
  dataStart: number;
  dataEnd: number;
  unknownSize: boolean;
};

type AudioTrack = {
  number: number;
  timestampScale: number;
  defaultDurationNs: number | null;
};

function invalidAudio(message = "Audio container is invalid or unsupported."): never {
  throw new Error(message);
}

function readVint(
  bytes: Uint8Array,
  offset: number,
  preserveMarker: boolean,
  maxLength: number,
): { value: number; length: number; unknownSize: boolean } {
  const first = bytes[offset];
  if (first === undefined || first === 0) invalidAudio();

  let marker = 0x80;
  let length = 1;
  while ((first & marker) === 0) {
    marker >>= 1;
    length += 1;
    if (marker === 0 || length > maxLength) invalidAudio();
  }
  if (offset + length > bytes.length) invalidAudio();

  const valueMask = marker - 1;
  let value = preserveMarker ? first : first & valueMask;
  for (let index = 1; index < length; index += 1) {
    value = value * 256 + bytes[offset + index]!;
  }

  const unknownSize =
    !preserveMarker &&
    (first & valueMask) === valueMask &&
    bytes.slice(offset + 1, offset + length).every((byte) => byte === 0xff);

  if (!unknownSize && !Number.isSafeInteger(value)) invalidAudio();
  return { value: unknownSize ? 0 : value, length, unknownSize };
}

function readElement(
  bytes: Uint8Array,
  offset: number,
  parentEnd: number,
): EbmlElement {
  const id = readVint(bytes, offset, true, 4);
  const size = readVint(bytes, offset + id.length, false, 8);
  const dataStart = offset + id.length + size.length;
  const dataEnd = size.unknownSize ? parentEnd : dataStart + size.value;

  if (
    dataStart > parentEnd ||
    dataEnd < dataStart ||
    dataEnd > parentEnd ||
    (size.unknownSize && id.value !== SEGMENT_ID && id.value !== CLUSTER_ID)
  ) {
    invalidAudio();
  }
  return { id: id.value, dataStart, dataEnd, unknownSize: size.unknownSize };
}

function findUnknownClusterEnd(
  bytes: Uint8Array,
  start: number,
  end: number,
): number {
  let offset = start;
  while (offset < end) {
    const child = readElement(bytes, offset, end);
    // A new Cluster, or a new EBML header starting another initialization
    // segment, closes an unknown-sized Cluster at the Segment level.
    if (child.id === CLUSTER_ID || child.id === EBML_HEADER_ID) return offset;
    if (child.unknownSize) invalidAudio();
    offset = child.dataEnd;
  }
  return end;
}

function childElements(
  bytes: Uint8Array,
  start: number,
  end: number,
  allowUnknownClusterBoundaries = false,
): EbmlElement[] {
  const elements: EbmlElement[] = [];
  let offset = start;
  while (offset < end) {
    const element = readElement(bytes, offset, end);
    if (allowUnknownClusterBoundaries && element.id === CLUSTER_ID && element.unknownSize) {
      element.dataEnd = findUnknownClusterEnd(bytes, element.dataStart, end);
      element.unknownSize = false;
    }
    elements.push(element);
    offset = element.dataEnd;
    if (element.unknownSize) break;
  }
  if (offset !== end) invalidAudio();
  return elements;
}

function readUnsigned(bytes: Uint8Array, element: EbmlElement): number {
  const length = element.dataEnd - element.dataStart;
  if (length < 1 || length > 6) invalidAudio();
  let value = 0;
  for (let index = element.dataStart; index < element.dataEnd; index += 1) {
    value = value * 256 + bytes[index]!;
  }
  if (!Number.isSafeInteger(value)) invalidAudio();
  return value;
}

function readFloat(bytes: Uint8Array, element: EbmlElement): number {
  const length = element.dataEnd - element.dataStart;
  if (length !== 4 && length !== 8) invalidAudio();
  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset + element.dataStart,
    length,
  );
  const value = length === 4 ? view.getFloat32(0, false) : view.getFloat64(0, false);
  if (!Number.isFinite(value) || value <= 0) invalidAudio();
  return value;
}

function readText(bytes: Uint8Array, element: EbmlElement): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(
      bytes.subarray(element.dataStart, element.dataEnd),
    );
  } catch {
    return invalidAudio();
  }
}

function parseOpusPacketDurationNs(packet: Uint8Array): number {
  if (packet.length < 1) invalidAudio();
  const toc = packet[0]!;
  const config = toc >> 3;
  const frameCode = toc & 0x03;

  const frameDurationMs =
    config < 12
      ? [10, 20, 40, 60][config & 0x03]!
      : config < 16
        ? [10, 20][config & 0x01]!
        : [2.5, 5, 10, 20][config & 0x03]!;

  let frameCount: number;
  if (frameCode === 0) {
    frameCount = 1;
  } else if (frameCode === 1 || frameCode === 2) {
    frameCount = 2;
  } else {
    if (packet.length < 2) invalidAudio();
    frameCount = packet[1]! & 0x3f;
    if (frameCount < 1 || frameCount > 48) invalidAudio();
  }

  const durationMs = frameDurationMs * frameCount;
  if (durationMs > 120) invalidAudio();
  return durationMs * 1_000_000;
}

function readBlockTrackNumber(bytes: Uint8Array, offset: number): {
  value: number;
  nextOffset: number;
} {
  const vint = readVint(bytes, offset, false, 8);
  if (vint.unknownSize || vint.value < 1) invalidAudio();
  return { value: vint.value, nextOffset: offset + vint.length };
}

function readLacedFrames(bytes: Uint8Array, offset: number, end: number, lacing: number): Uint8Array[] {
  if (lacing === 0) {
    if (offset >= end) invalidAudio();
    return [bytes.subarray(offset, end)];
  }

  if (offset >= end) invalidAudio();
  const frameCount = bytes[offset]! + 1;
  offset += 1;
  if (frameCount < 2 || frameCount > 256) invalidAudio();

  const sizes: number[] = [];
  if (lacing === 1) {
    for (let frame = 0; frame < frameCount - 1; frame += 1) {
      let size = 0;
      let part: number;
      do {
        if (offset >= end) invalidAudio();
        part = bytes[offset++]!;
        size += part;
      } while (part === 255);
      sizes.push(size);
    }
  } else if (lacing === 2) {
    const remaining = end - offset;
    if (remaining % frameCount !== 0) invalidAudio();
    const size = remaining / frameCount;
    for (let frame = 0; frame < frameCount - 1; frame += 1) sizes.push(size);
  } else if (lacing === 3) {
    const firstSize = readVint(bytes, offset, false, 8);
    if (firstSize.unknownSize || firstSize.value < 1) invalidAudio();
    offset += firstSize.length;
    sizes.push(firstSize.value);

    for (let frame = 1; frame < frameCount - 1; frame += 1) {
      const delta = readVint(bytes, offset, false, 8);
      if (delta.unknownSize) invalidAudio();
      offset += delta.length;
      const bias = 2 ** (7 * delta.length - 1) - 1;
      const nextSize = sizes[frame - 1]! + delta.value - bias;
      if (!Number.isSafeInteger(nextSize) || nextSize < 1) invalidAudio();
      sizes.push(nextSize);
    }
  } else {
    invalidAudio();
  }

  const headerEnd = offset;
  const remainingBytes = end - headerEnd;
  const knownBytes = sizes.reduce((sum, size) => sum + size, 0);
  const lastSize = remainingBytes - knownBytes;
  if (lastSize < 1) invalidAudio();
  sizes.push(lastSize);

  const frames: Uint8Array[] = [];
  let cursor = headerEnd;
  for (const size of sizes) {
    if (size < 1 || cursor + size > end) invalidAudio();
    frames.push(bytes.subarray(cursor, cursor + size));
    cursor += size;
  }
  if (cursor !== end) invalidAudio();
  return frames;
}

function parseBlock(
  bytes: Uint8Array,
  start: number,
  end: number,
  clusterTimecode: number,
  track: AudioTrack,
  timecodeScaleNs: number,
  declaredBlockDurationTicks: number | null,
): { startNs: number; endNs: number } {
  const trackNumber = readBlockTrackNumber(bytes, start);
  let offset = trackNumber.nextOffset;
  if (offset + 3 > end) invalidAudio();

  const relativeTimestamp = new DataView(
    bytes.buffer,
    bytes.byteOffset + offset,
    2,
  ).getInt16(0, false);
  offset += 2;
  const flags = bytes[offset++]!;
  const lacing = (flags >> 1) & 0x03;

  if (trackNumber.value !== track.number) invalidAudio();
  const frames = readLacedFrames(bytes, offset, end, lacing);
  let packetDurationNs = 0;
  for (const frame of frames) packetDurationNs += parseOpusPacketDurationNs(frame);

  const startTicks = clusterTimecode + relativeTimestamp * track.timestampScale;
  const startNs = startTicks * timecodeScaleNs;
  const declaredDurationNs =
    declaredBlockDurationTicks === null
      ? 0
      : declaredBlockDurationTicks * track.timestampScale * timecodeScaleNs;
  const durationNs = Math.max(
    packetDurationNs,
    track.defaultDurationNs ?? 0,
    declaredDurationNs,
  );
  const endNs = startNs + durationNs;

  if (
    !Number.isFinite(startNs) ||
    !Number.isFinite(endNs) ||
    startNs < 0 ||
    durationNs <= 0
  ) {
    invalidAudio();
  }
  return { startNs, endNs };
}

function parseAudioTrack(bytes: Uint8Array, element: EbmlElement): AudioTrack {
  const children = childElements(bytes, element.dataStart, element.dataEnd);
  const get = (id: number) => children.find((child) => child.id === id);
  const numberElement = get(TRACK_NUMBER_ID);
  const typeElement = get(TRACK_TYPE_ID);
  const codecElement = get(CODEC_ID_ID);
  const privateElement = get(CODEC_PRIVATE_ID);

  if (!numberElement || !typeElement || !codecElement || !privateElement) invalidAudio();
  const number = readUnsigned(bytes, numberElement);
  const trackType = readUnsigned(bytes, typeElement);
  const codecId = readText(bytes, codecElement);
  const codecPrivate = bytes.subarray(privateElement.dataStart, privateElement.dataEnd);

  if (
    number < 1 ||
    trackType !== 2 ||
    codecId !== "A_OPUS" ||
    codecPrivate.length < 19 ||
    readText(bytes, {
      ...privateElement,
      dataEnd: privateElement.dataStart + 8,
    }) !== "OpusHead"
  ) {
    invalidAudio("Only WebM audio containing an Opus track is supported.");
  }

  const timestampScaleElement = get(TRACK_TIMESTAMP_SCALE_ID);
  const defaultDurationElement = get(DEFAULT_DURATION_ID);
  const timestampScale = timestampScaleElement
    ? readFloat(bytes, timestampScaleElement)
    : 1;
  const defaultDurationNs = defaultDurationElement
    ? readUnsigned(bytes, defaultDurationElement)
    : null;

  if (timestampScale > 100 || (defaultDurationNs !== null && defaultDurationNs <= 0)) {
    invalidAudio();
  }

  return { number, timestampScale, defaultDurationNs };
}

function parseCluster(
  bytes: Uint8Array,
  element: EbmlElement,
  track: AudioTrack,
  timecodeScaleNs: number,
): { startNs: number; endNs: number }[] {
  const children = childElements(bytes, element.dataStart, element.dataEnd);
  const timecodeElement = children.find((child) => child.id === CLUSTER_TIMECODE_ID);
  if (!timecodeElement) invalidAudio();
  const clusterTimecode = readUnsigned(bytes, timecodeElement);
  const ranges: { startNs: number; endNs: number }[] = [];

  for (const child of children) {
    if (child.id === SIMPLE_BLOCK_ID) {
      ranges.push(parseBlock(
        bytes,
        child.dataStart,
        child.dataEnd,
        clusterTimecode,
        track,
        timecodeScaleNs,
        null,
      ));
    } else if (child.id === BLOCK_GROUP_ID) {
      const groupChildren = childElements(bytes, child.dataStart, child.dataEnd);
      const block = groupChildren.find((entry) => entry.id === BLOCK_ID);
      const blockDuration = groupChildren.find((entry) => entry.id === BLOCK_DURATION_ID);
      if (!block) invalidAudio();
      ranges.push(parseBlock(
        bytes,
        block.dataStart,
        block.dataEnd,
        clusterTimecode,
        track,
        timecodeScaleNs,
        blockDuration ? readUnsigned(bytes, blockDuration) : null,
      ));
    }
  }
  return ranges;
}

/**
 * Parse the playable timeline of a single-track WebM/Opus recording.
 * Duration is derived from actual block timestamps and Opus TOC frame counts,
 * not from the client-supplied duration or the optional WebM Info/Duration field.
 */
export function getWebmOpusDurationSeconds(bytes: Uint8Array): number {
  if (bytes.length < 32 || bytes.length > 1024 * 1024) invalidAudio();

  const topLevel = childElements(bytes, 0, bytes.length);
  const header = topLevel.find((element) => element.id === EBML_HEADER_ID);
  const segment = topLevel.find((element) => element.id === SEGMENT_ID);
  if (!header || !segment) invalidAudio();

  const headerChildren = childElements(bytes, header.dataStart, header.dataEnd);
  const docType = headerChildren.find((element) => element.id === EBML_DOCTYPE_ID);
  if (!docType || readText(bytes, docType) !== "webm") invalidAudio();

  const segmentChildren = childElements(bytes, segment.dataStart, segment.dataEnd, true);
  const info = segmentChildren.find((element) => element.id === INFO_ID);
  const tracksElement = segmentChildren.find((element) => element.id === TRACKS_ID);
  if (!tracksElement) invalidAudio();

  let timecodeScaleNs = 1_000_000;
  if (info) {
    const infoChildren = childElements(bytes, info.dataStart, info.dataEnd);
    const scaleElement = infoChildren.find((element) => element.id === TIMECODE_SCALE_ID);
    if (scaleElement) timecodeScaleNs = readUnsigned(bytes, scaleElement);
  }
  if (timecodeScaleNs < 1 || timecodeScaleNs > 1_000_000_000) invalidAudio();

  const trackEntries = childElements(bytes, tracksElement.dataStart, tracksElement.dataEnd)
    .filter((element) => element.id === TRACK_ENTRY_ID);
  if (trackEntries.length !== 1) {
    invalidAudio("Only single-track WebM audio recordings are supported.");
  }
  const track = parseAudioTrack(bytes, trackEntries[0]!);

  const clusters = segmentChildren.filter((element) => element.id === CLUSTER_ID);
  if (clusters.length === 0) invalidAudio();

  let minimumStartNs = Number.POSITIVE_INFINITY;
  let maximumEndNs = 0;
  let blockCount = 0;

  for (const cluster of clusters) {
    const ranges = parseCluster(bytes, cluster, track, timecodeScaleNs);
    for (const range of ranges) {
      minimumStartNs = Math.min(minimumStartNs, range.startNs);
      maximumEndNs = Math.max(maximumEndNs, range.endNs);
      blockCount += 1;
    }
  }

  if (
    blockCount === 0 ||
    !Number.isFinite(minimumStartNs) ||
    maximumEndNs <= minimumStartNs
  ) {
    invalidAudio();
  }

  return (maximumEndNs - minimumStartNs) / NANOS_PER_SECOND;
}
