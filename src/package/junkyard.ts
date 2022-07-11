// junkyard.ts a/k/a "tools" or "utils"

export type Bit = 0 | 1;

/** 
 * Convert binary (buffer) into array of bits,
 * least siginificant first.
 */
export function bitsFromBytes(bytes: ArrayLike<number>): Bit[] {
	const bits: Bit[] = [];
	for (let bytePos = 0; bytePos < bytes.length; bytePos++) {
		const byte = bytes[bytePos];
		for (let bitPos = 0; bitPos < 8; bitPos++) {
			bits.push((byte >>> bitPos & 1) as Bit);
		}
	}
	return bits;
}

/** 
 * Convert array of bits back into buffer.
 * Incomplete bytes are padded with zeroes.
 */
export function bytesFromBits(bits: ArrayLike<Bit>): Uint8Array {
	const bytes = new Uint8Array(Math.ceil(bits.length / 8));
	for (let bitOffset = 0; bitOffset < bits.length; bitOffset++) {
		bytes[bitOffset >>> 3] |= (bits[bitOffset] & 1) << (bitOffset & 7);
	}
	return bytes;
}

/**
 * Concatenates several Uint8Array's (byte typed arrays) into one.
 */
export function bytesConcat(...uias: readonly Uint8Array[]): Uint8Array {
	let offset = 0;
	for (const uia of uias) {
		offset += uia.length;
	}
	const concatenated = new Uint8Array(offset);
	offset = 0;
	for (const uia of uias) {
		concatenated.set(uia, offset);
		offset += uia.length;
	}
	return concatenated;
}

/** Staring in the attribute context */
export function findTagEnd(htmlChunk: string): number {
	const cleanedChunk = htmlChunk.replace(/[^ \t\n\r>]+=("|').*?(\1|$)/g, (s) => 'x'.repeat(s.length));
	return cleanedChunk.indexOf('>');
}

let textDecoder = new TextDecoder();
export function stringFromBytes(bytes: Uint8Array): string {
	return textDecoder.decode(bytes);
}

let textEncoder = new TextEncoder();
export function bytesFromString(str: string): Uint8Array {
	return textEncoder.encode(str);
}