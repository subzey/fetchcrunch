#!/usr/bin/env node
/// <reference types="node"/>
import { deflateRawSync, inflateRawSync } from 'node:zlib';

import Zopfli from 'zopfli.js';

/** @typedef {(0 | 1)} Bit */

/** 
 * Convert binary (buffer) into array of bits,
 * least siginificant first.
 * @param {readonly number[]} bytes
 * @returns {Bit[]}
 */
function bitsFromBuffer(bytes) {
	/** @type {Bit[]} */
	const bits = [];
	for (const byte of bytes) {
		for (let bitPos = 0; bitPos < 8; bitPos++) {
			bits.push(byte >>> bitPos & 1);
		}
	}
	return bits;
}

/** 
 * Convert array of bits back into buffer.
 * Incomplete bytes are padded with zero.
 * @param {ArrayLike<Bit>} bits
 * @returns {Buffer}
 */
function bufferFromBits(bits) {
	const bytes = Buffer.alloc(Math.ceil(bits.length / 8));
	for (let bitOffset = 0; bitOffset < bits.length; bitOffset++) {
		bytes[bitOffset >>> 3] |= (bits[bitOffset] & 1) << (bitOffset & 7);
	}
	return bytes;
}


const ATTRIBUTE_SEPARATORS = new Set([' ', '\t', '\n', '/', '\r']);

function htmlVariants(html, prefix = '') {
	const altSequence = Array.from(
		html,
		(ch) => {
			if (ATTRIBUTE_SEPARATORS.has(ch)) {
				return ATTRIBUTE_SEPARATORS;
			}
			return new Set([ch, ch.toUpperCase(), ch.toLowerCase()]);
		}
	);

	return pickEachVariant(prefix, altSequence, 0);
}

function * pickEachVariant(prefix, altSequence, startingWith) {
	if (startingWith >= altSequence.length) {
		yield prefix;
	} else {
		for (const alt of altSequence[startingWith]) {
			yield * pickEachVariant(prefix + alt, altSequence, startingWith + 1);
		}
	}
}

function * leadInVariants(bootstrapHead, bootstrapTail) {
	const zeroLength = Buffer.of(0x00, 0x00, 0xff, 0xff);
	const bootstrapTailBinary = Buffer.from(' ' + bootstrapTail.trim());
	for (const variant of htmlVariants(bootstrapHead)) {
		const bits = bitsFromBuffer(Buffer.from(
			// This is the core idea of the entire app.
			// From HTML perspective it's a whitespace.
			// From Deflate perspective at starts a new block with fixed Huffman codes.
			'\n' +
			variant
		));
		// The block is terminated on a special "end of block" value
		// Good news: it's a sequence of seven zero bits.
		// Bad news: we don't know exactly where to put them.
		// We just keep adding zero bits until it works.
		for (const zeroBits = []; zeroBits.length <= 16; zeroBits.push(0)) {
			const buf = Buffer.concat([
				bufferFromBits([
					...bits,
					...zeroBits,
					// Block type 0 introducer. Final flag is set.
					1, 0, 0,
				]),
				// 4 bytes of a block-type-0 payload length
				zeroLength
			]);
			try {
				inflateRawSync(buf);
			} catch (e) {
				// No luck
				continue;
			}
			yield Buffer.concat([
				bufferFromBits([
					...bits,
					...zeroBits,
					// A type 0 block again, but not final this time
					0, 0, 0
				]),
				// 4 bytes: Length of the payload following
				Buffer.of(
					bootstrapTailBinary.byteLength & 0xff, bootstrapTailBinary.byteLength >> 8,
					~bootstrapTailBinary.byteLength & 0xff, ~bootstrapTailBinary.byteLength >> 8
				),
				bootstrapTailBinary
			]);
			break;
		}
	}
}

function compress(input) {
	// return deflateRawSync(input);
	const deflater = new Zopfli.Zopfli.RawDeflate(Buffer.from(input), { iterations: 50 });
	// TODO: The compression may benefit for using the bootstrap data as a dictionary
	// Unfortunately, there's apparently no way to do it.
	// It's time to write a custom deflate compressor :D
	return deflater.compress();
}

// Omit the trailing <!-- if you're okay with the page full of binary garbage
const DEFAULT_BOOTSTRAP = '<body onload="(async s=>{for(r=(await fetch(``)).body.pipeThrough(new DecompressionStream(`deflate-raw`)).pipeThrough(new TextDecoderStream).getReader();c=(await r.read()).value;s+=c);eval(s)})\`//\`"><!--';

/**
 * @param {string} payload 
 * @param {string} [bootstrapHtml]
 */
function main(payload, bootstrapHtml=DEFAULT_BOOTSTRAP) {
	let [, bootstrapHead, bootstrapTail] = /^\s*(\S+\s?)\s*(.*)/.exec(bootstrapHtml);
	const deflated = compress('\n' + payload);
	let bestLeadIn = null;
	for (const leadIn of leadInVariants(bootstrapHead, bootstrapTail)) {
		if (!bestLeadIn) {
			bestLeadIn = leadIn;
		}
		if (leadIn.byteLength < bestLeadIn.byteLength) {
			bestLeadIn = leadIn;
		}
	}
	const assembled = Buffer.concat([
		bestLeadIn,
		deflated,
	]);
	// Final check
	inflateRawSync(assembled);
	return assembled;
}


Promise.resolve(main('debugger /* for your convenience */; document.body.innerHTML = "<h1>Looks like it works 🎉</h1>"')).then(b => process.stdout.write(b));