type EbmlElement = { id: number; dataStart: number; end: number };

function fail(message: string): never {
  throw new Error(message);
}

function readVint(bytes: Uint8Array, offset: number, isId: boolean): {
  value: number;
  length: number;
  unknown: boolean;
} {
  if (offset >= bytes.length) return fail("Truncated EBML variable integer.");
  const first = bytes[offset];
  if (first === 0) return fail("Invalid EBML variable integer.");
  let marker = 0x80;
  let length = 1;
  while ((first & marker) === 0) {
    marker >>= 1;
    length += 1;
  }
  if (length > (isId ? 4 : 8) || offset + length > bytes.length) {
    return fail("Invalid EBML variable integer length.");
  }
  let value = BigInt(isId ? first : first & (marker - 1));
  for (let index = 1; index < length; index += 1) {
    value = (value << 8n) | BigInt(bytes[offset + index]);
  }
  const unknown = !isId && value === (1n << BigInt(7 * length)) - 1n;
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) return fail("EBML integer exceeds safe parsing range.");
  return { value: Number(value), length, unknown };
}

function readEbmlElements(bytes: Uint8Array, start: number, end: number): EbmlElement[] {
  const elements: EbmlElement[] = [];
  let offset = start;
  while (offset < end) {
    const id = readVint(bytes, offset, true);
    const size = readVint(bytes, offset + id.length, false);
    const dataStart = offset + id.length + size.length;
    const elementEnd = size.unknown ? end : dataStart + size.value;
    if (dataStart > end || elementEnd > end || elementEnd < dataStart) {
      return fail("EBML element exceeds its parent container.");
    }
    elements.push({ id: id.value, dataStart, end: elementEnd });
    if (size.unknown) break;
    if (elementEnd === offset) return fail("Invalid zero-length EBML element.");
    offset = elementEnd;
  }
  return elements;
}

function readUnsigned(bytes: Uint8Array, start: number, end: number): number {
  const length = end - start;
  if (length < 1 || length > 8) return fail("Invalid unsigned integer field.");
  let value = 0n;
  for (let offset = start; offset < end; offset += 1) {
    value = (value << 8n) | BigInt(bytes[offset]);
  }
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) return fail("Media metadata integer exceeds safe range.");
  return Number(value);
}

function readFloat(bytes: Uint8Array, start: number, end: number): number {
  const length = end - start;
  const view = new DataView(bytes.buffer, bytes.byteOffset + start, length);
  if (length === 4) return view.getFloat32(0, false);
  if (length === 8) return view.getFloat64(0, false);
  return fail("Unsupported EBML floating-point size.");
}

function readAscii(bytes: Uint8Array, start: number, end: number): string {
  let value = "";
  for (let offset = start; offset < end; offset += 1) value += String.fromCharCode(bytes[offset]);
  return value;
}

function parseWebmDuration(bytes: Uint8Array): number {
  const topLevel = readEbmlElements(bytes, 0, bytes.length);
  const ebmlHeader = topLevel.find((element) => element.id === 0x1a45dfa3);
  const segment = topLevel.find((element) => element.id === 0x18538067);
  if (!ebmlHeader || !segment) return fail("The WebM EBML header or Segment is missing.");

  const segmentChildren = readEbmlElements(bytes, segment.dataStart, segment.end);
  const info = segmentChildren.find((element) => element.id === 0x1549a966);
  const tracks = segmentChildren.find((element) => element.id === 0x1654ae6b);
  if (!info || !tracks) return fail("WebM Info or Tracks metadata is missing.");

  const infoChildren = readEbmlElements(bytes, info.dataStart, info.end);
  const scaleElement = infoChildren.find((element) => element.id === 0x2ad7b1);
  const durationElement = infoChildren.find((element) => element.id === 0x4489);
  if (!durationElement) return fail("WebM recording has no verifiable Duration element.");
  const timecodeScale = scaleElement
    ? readUnsigned(bytes, scaleElement.dataStart, scaleElement.end)
    : 1_000_000;
  const durationTicks = readFloat(bytes, durationElement.dataStart, durationElement.end);
  if (!Number.isFinite(durationTicks) || durationTicks <= 0 || timecodeScale <= 0) {
    return fail("WebM duration metadata is invalid.");
  }

  const trackEntries = readEbmlElements(bytes, tracks.dataStart, tracks.end)
    .filter((element) => element.id === 0xae);
  const hasOpusAudio = trackEntries.some((entry) => {
    const fields = readEbmlElements(bytes, entry.dataStart, entry.end);
    const trackType = fields.find((field) => field.id === 0x83);
    const codec = fields.find((field) => field.id === 0x86);
    return Boolean(
      trackType &&
      codec &&
      readUnsigned(bytes, trackType.dataStart, trackType.end) === 2 &&
      readAscii(bytes, codec.dataStart, codec.end) === "A_OPUS",
    );
  });
  if (!hasOpusAudio) return fail("WebM must contain an Opus audio track.");

  const hasCluster = segmentChildren.some((element) => element.id === 0x1f43b675);
  if (!hasCluster) return fail("WebM contains no audio clusters.");
  return (durationTicks * timecodeScale) / 1_000_000_000;
}

function parseOggOpusDuration(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  let serial: number | null = null;
  let expectedSequence = 0;
  let firstPacket: number[] = [];
  let firstPacketComplete = false;
  let finalGranule: bigint | null = null;

  while (offset < bytes.length) {
    if (offset + 27 > bytes.length || readAscii(bytes, offset, offset + 4) !== "OggS") {
      return fail("Invalid or truncated Ogg page.");
    }
    if (bytes[offset + 4] !== 0) return fail("Unsupported Ogg bitstream version.");
    const headerType = bytes[offset + 5];
    const pageSerial = view.getUint32(offset + 14, true);
    const pageSequence = view.getUint32(offset + 18, true);
    const segmentCount = bytes[offset + 26];
    const tableStart = offset + 27;
    const bodyStart = tableStart + segmentCount;
    if (bodyStart > bytes.length) return fail("Truncated Ogg segment table.");
    if (serial === null) {
      if ((headerType & 0x02) === 0) return fail("Ogg stream is missing its beginning-of-stream page.");
      serial = pageSerial;
    }
    if (pageSerial !== serial || pageSequence !== expectedSequence) {
      return fail("Ogg stream serial or page sequence is inconsistent.");
    }
    expectedSequence += 1;

    let bodyOffset = bodyStart;
    for (let index = 0; index < segmentCount; index += 1) {
      const segmentLength = bytes[tableStart + index];
      if (bodyOffset + segmentLength > bytes.length) return fail("Truncated Ogg page body.");
      if (!firstPacketComplete) {
        for (let byte = bodyOffset; byte < bodyOffset + segmentLength; byte += 1) {
          firstPacket.push(bytes[byte]);
        }
        if (segmentLength < 255) firstPacketComplete = true;
      }
      bodyOffset += segmentLength;
    }

    const granule = view.getBigUint64(offset + 6, true);
    const unknownGranule = 0xffffffffffffffffn;
    if ((headerType & 0x04) !== 0) {
      if (granule === unknownGranule || bodyOffset !== bytes.length) {
        return fail("Ogg end-of-stream page has an invalid granule position.");
      }
      finalGranule = granule;
    } else if (granule !== unknownGranule && finalGranule !== null) {
      return fail("Ogg data appears after the end-of-stream page.");
    }

    offset = bodyOffset;
  }

  if (!firstPacketComplete || firstPacket.length < 19 || readAscii(Uint8Array.from(firstPacket), 0, 8) !== "OpusHead") {
    return fail("Ogg stream does not begin with a valid Opus identification packet.");
  }
  if (firstPacket[8] > 15 || firstPacket[9] === 0) return fail("Ogg Opus identification header is invalid.");
  if (finalGranule === null) return fail("Ogg stream has no final granule position.");
  const preSkip = firstPacket[10] | (firstPacket[11] << 8);
  if (finalGranule < BigInt(preSkip)) return fail("Ogg Opus final granule precedes its pre-skip value.");
  const duration = Number(finalGranule - BigInt(preSkip)) / 48_000;
  if (!Number.isFinite(duration) || duration <= 0) return fail("Ogg Opus duration is invalid.");
  return duration;
}

type Mp4Box = { type: string; dataStart: number; end: number };

function readMp4Boxes(bytes: Uint8Array, start: number, end: number): Mp4Box[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const boxes: Mp4Box[] = [];
  let offset = start;
  while (offset < end) {
    if (offset + 8 > end) return fail("Truncated MP4 box header.");
    let size = view.getUint32(offset, false);
    const type = readAscii(bytes, offset + 4, offset + 8);
    let headerSize = 8;
    if (size === 1) {
      if (offset + 16 > end) return fail("Truncated extended MP4 box header.");
      const extended = view.getBigUint64(offset + 8, false);
      if (extended > BigInt(Number.MAX_SAFE_INTEGER)) return fail("MP4 box is too large to inspect.");
      size = Number(extended);
      headerSize = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < headerSize || offset + size > end) return fail("MP4 box exceeds its parent container.");
    boxes.push({ type, dataStart: offset + headerSize, end: offset + size });
    offset += size;
  }
  return boxes;
}

function parseMp4HeaderDuration(bytes: Uint8Array, box: Mp4Box): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = bytes[box.dataStart];
  if (version === 0) {
    if (box.dataStart + 20 > box.end) return fail("Truncated MP4 version-zero media header.");
    const timescale = view.getUint32(box.dataStart + 12, false);
    const duration = view.getUint32(box.dataStart + 16, false);
    return timescale > 0 && duration > 0 ? duration / timescale : fail("MP4 media duration is invalid.");
  }
  if (version === 1) {
    if (box.dataStart + 32 > box.end) return fail("Truncated MP4 version-one media header.");
    const timescale = view.getUint32(box.dataStart + 20, false);
    const duration = view.getBigUint64(box.dataStart + 24, false);
    if (timescale === 0 || duration === 0n || duration > BigInt(Number.MAX_SAFE_INTEGER)) {
      return fail("MP4 media duration is invalid.");
    }
    return Number(duration) / timescale;
  }
  return fail("Unsupported MP4 media header version.");
}

function parseMp4Duration(bytes: Uint8Array): number {
  const topLevel = readMp4Boxes(bytes, 0, bytes.length);
  const moov = topLevel.find((box) => box.type === "moov");
  if (!topLevel.some((box) => box.type === "ftyp") || !moov) {
    return fail("MP4 file type or movie metadata is missing.");
  }
  const movieBoxes = readMp4Boxes(bytes, moov.dataStart, moov.end);
  const audioTrackDurations: number[] = [];
  for (const track of movieBoxes.filter((box) => box.type === "trak")) {
    const trackBoxes = readMp4Boxes(bytes, track.dataStart, track.end);
    const media = trackBoxes.find((box) => box.type === "mdia");
    if (!media) continue;
    const mediaBoxes = readMp4Boxes(bytes, media.dataStart, media.end);
    const handler = mediaBoxes.find((box) => box.type === "hdlr");
    const mediaHeader = mediaBoxes.find((box) => box.type === "mdhd");
    if (!handler || !mediaHeader || handler.dataStart + 12 > handler.end) continue;
    if (readAscii(bytes, handler.dataStart + 8, handler.dataStart + 12) !== "soun") continue;
    audioTrackDurations.push(parseMp4HeaderDuration(bytes, mediaHeader));
  }
  if (audioTrackDurations.length === 0) return fail("MP4 contains no audio track with duration metadata.");
  const movieHeader = movieBoxes.find((box) => box.type === "mvhd");
  const movieDuration = movieHeader ? parseMp4HeaderDuration(bytes, movieHeader) : 0;
  return Math.max(movieDuration, ...audioTrackDurations);
}

export function inspectAudioDuration(bytes: Uint8Array, mimeType: string): number {
  switch (mimeType.split(";")[0].trim().toLowerCase()) {
    case "audio/webm":
      return parseWebmDuration(bytes);
    case "audio/ogg":
      return parseOggOpusDuration(bytes);
    case "audio/mp4":
      return parseMp4Duration(bytes);
    default:
      return fail("Unsupported audio container.");
  }
}
