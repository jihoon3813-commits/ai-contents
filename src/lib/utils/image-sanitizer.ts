/**
 * 이미지 자산 보안 검사 및 메타데이터(EXIF) 제거 유틸리티
 */

/**
 * 버퍼 바이너리의 매직 넘버(Magic Bytes)를 감지하여 실제 MIME 타입을 파악합니다.
 * 확장자 위조를 우회 차단하기 위해 사용합니다.
 */
export function getRealMimeType(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;

  // 1. JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return "image/jpeg";
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return "image/png";
  }

  // 3. WebP: RIFF (4bytes) ... WEBP (4bytes at offset 8)
  const riff = buffer.toString("ascii", 0, 4);
  const webp = buffer.toString("ascii", 8, 12);
  if (riff === "RIFF" && webp === "WEBP") {
    return "image/webp";
  }

  return null;
}

/**
 * 업로드하려는 파일이 악성 실행 파일이나 SVG(XSS 벡터)인지 바이너리 레벨에서 차단합니다.
 */
export function validateFileSecurity(buffer: Buffer, originalFilename: string): { allowed: boolean; reason?: string } {
  // SVG 파일 차단
  const lowerName = originalFilename.toLowerCase();
  if (lowerName.endsWith(".svg") || lowerName.endsWith(".svgz")) {
    return { allowed: false, reason: "안전하지 않은 SVG 이미지 업로드는 금지되어 있습니다." };
  }

  // executable(실행 파일) MZ 헤더 검출 차단
  if (buffer.length >= 2 && buffer[0] === 0x4D && buffer[1] === 0x5A) { // 'MZ'
    return { allowed: false, reason: "실행 파일(.exe, .dll 등)은 업로드할 수 없습니다." };
  }

  const mime = getRealMimeType(buffer);
  const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
  if (!mime || !allowedMimes.includes(mime)) {
    return { allowed: false, reason: "허용된 이미지 포맷(JPG, JPEG, PNG, WebP)이 아닙니다." };
  }

  return { allowed: true };
}

/**
 * JPEG 파일에서 APP1(EXIF, GPS 등) 세그먼트를 제거합니다.
 */
export function stripExifJpeg(buffer: Buffer): Buffer {
  if (buffer.length < 4) return buffer;
  if (buffer[0] !== 0xFF || buffer[1] !== 0xD8) return buffer;

  const resultChunks: Buffer[] = [];
  resultChunks.push(buffer.subarray(0, 2)); // SOI 적재

  let pos = 2;
  while (pos < buffer.length) {
    if (buffer[pos] !== 0xFF) {
      resultChunks.push(buffer.subarray(pos));
      break;
    }

    const marker = buffer[pos + 1];
    if (marker === 0xD9) { // EOI (End of Image)
      resultChunks.push(buffer.subarray(pos, pos + 2));
      break;
    }
    if (marker === 0xDA) { // SOS (Start of Scan - 이미지 엔트로피 데이터 시작)
      resultChunks.push(buffer.subarray(pos));
      break;
    }

    // 길이 없는 마커 스킵
    if (marker === 0xD8 || (marker >= 0xD0 && marker <= 0xD7) || marker === 0x01) {
      resultChunks.push(buffer.subarray(pos, pos + 2));
      pos += 2;
      continue;
    }

    if (pos + 3 >= buffer.length) {
      resultChunks.push(buffer.subarray(pos));
      break;
    }

    const len = (buffer[pos + 2] << 8) | buffer[pos + 3];
    const nextPos = pos + 2 + len;

    if (nextPos > buffer.length) {
      resultChunks.push(buffer.subarray(pos));
      break;
    }

    // EXIF(APP1) 마커 세그먼트 배제
    if (marker === 0xE1) {
      // Skip APP1 EXIF segment
    } else {
      resultChunks.push(buffer.subarray(pos, nextPos));
    }
    pos = nextPos;
  }

  return Buffer.concat(resultChunks);
}

/**
 * PNG 파일에서 eXIf, tEXt 등의 메타데이터 청크를 제거합니다.
 */
export function stripExifPng(buffer: Buffer): Buffer {
  if (buffer.length < 8) return buffer;
  const resultChunks: Buffer[] = [];
  resultChunks.push(buffer.subarray(0, 8)); // PNG Signature

  let pos = 8;
  while (pos + 8 <= buffer.length) {
    const len = buffer.readInt32BE(pos);
    const type = buffer.toString("ascii", pos + 4, pos + 8);
    const nextPos = pos + 12 + len; // 4(len) + 4(type) + len(data) + 4(crc)

    if (nextPos > buffer.length) {
      resultChunks.push(buffer.subarray(pos));
      break;
    }

    // eXIf 및 텍스트 메타데이터 청크 스킵
    if (type === "eXIf" || type === "tEXt" || type === "iTXt" || type === "zTXt") {
      // Skip metadata chunks
    } else {
      resultChunks.push(buffer.subarray(pos, nextPos));
    }
    pos = nextPos;
  }

  return Buffer.concat(resultChunks);
}

/**
 * WebP 파일에서 EXIF 및 ICCP 메타데이터 청크를 제거하고 크기를 재조정합니다.
 */
export function stripExifWebp(buffer: Buffer): Buffer {
  if (buffer.length < 12) return buffer;
  const riff = buffer.toString("ascii", 0, 4);
  const webp = buffer.toString("ascii", 8, 12);
  if (riff !== "RIFF" || webp !== "WEBP") return buffer;

  const bodyChunks: Buffer[] = [];
  bodyChunks.push(buffer.subarray(8, 12)); // WEBP signature

  let pos = 12;
  while (pos + 8 <= buffer.length) {
    const type = buffer.toString("ascii", pos, pos + 4);
    const size = buffer.readInt32LE(pos + 4);
    const paddedSize = size + (size % 2); // 홀수 크기 정렬 패딩
    const nextPos = pos + 8 + paddedSize;

    if (nextPos > buffer.length) {
      bodyChunks.push(buffer.subarray(pos));
      break;
    }

    // EXIF 및 ICCP 청크 스킵
    if (type === "EXIF" || type === "ICCP") {
      // Skip metadata chunks
    } else {
      bodyChunks.push(buffer.subarray(pos, nextPos));
    }
    pos = nextPos;
  }

  const body = Buffer.concat(bodyChunks);
  const newHeader = Buffer.alloc(8);
  newHeader.write("RIFF", 0, "ascii");
  newHeader.writeInt32LE(body.length, 4);

  return Buffer.concat([newHeader, body]);
}

/**
 * 포맷별 EXIF 메타데이터 제거 통합 엔트리
 */
export function stripMetadata(buffer: Buffer): Buffer {
  const mime = getRealMimeType(buffer);
  if (mime === "image/jpeg") {
    return stripExifJpeg(buffer);
  }
  if (mime === "image/png") {
    return stripExifPng(buffer);
  }
  if (mime === "image/webp") {
    return stripExifWebp(buffer);
  }
  return buffer;
}
