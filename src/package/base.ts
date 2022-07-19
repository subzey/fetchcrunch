import { bitsFromBytes, bytesFromBits, bytesConcat, findTagEnd, bytesFromString, stringFromBytes, charCodeBytesFromString } from "./junkyard.js";
import { bytesFromTemplate } from "./payload-dependent-template.js";
import { StringTemplate, StringTemplateVariants, irFromHtml, templatesFromIr, iterateThroughTemplate, BOOTSTRAP_ATTR_VALUE } from "./template.js";

export interface AssemblyParams {
	leadIn: Uint8Array;
	bootstrap: Uint8Array;
	tail: Uint8Array;
	payload: Uint8Array;

	literalNewline: boolean;
	literalIncludesTail: boolean;
	useCharCodes: boolean;
	
	leadInDecompressedSize: number;
	bestSize: number;
}

/**
 * A base class that works in node, browser and deno 
 */
export abstract class FetchCrunchBase {
	/** Implement me! */
	protected abstract _binaryFromDeflateRaw(compressed: Uint8Array): Uint8Array;
	/** Implement me! */
	protected abstract _deflateRawFromBinary(source: Uint8Array, dictionary: Uint8Array): Uint8Array | Promise<Uint8Array>;

	protected _htmlTemplate(): string {
		return `<svg onload="${ BOOTSTRAP_ATTR_VALUE }">`;
	}

	protected _onloadAttribute(useCharCodes: boolean, options: { reservedIdentifierNames: ReadonlySet<string> }): StringTemplate {
		const identifierNames = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_';
		const identifiers: StringTemplateVariants[] = [
			new Set('s' + identifierNames),
			new Set('r' + identifierNames),
			new Set('c' + identifierNames),
		];
		for (const identifier of identifiers) {
			for (const reservedIdentifierName of options.reservedIdentifierNames) {
				identifier.delete(reservedIdentifierName);
			}
			for (const otherIdentifier of identifiers) {
				if (identifier === otherIdentifier) {
					continue;
				}
				identifier.mutuallyExclusiveWith ??= [];
				identifier.mutuallyExclusiveWith.push(otherIdentifier);
			}
		}

		const [evaledStringV, readerV, chunkV] = identifiers;

		/**
		 * Decode data as the array of charCodes.
		 * This code is shorter, but can be used only for short strings of codepoints U+0000 .. U+00FF.
		 * 
		 * Massive thanks to [Kang Seonghoon](https://twitter.com/senokay) for this method!
		 */
		const readAsCharCodes = [
			'for(',
				readerV, '=(await fetch`#`).body.pipeThrough(new DecompressionStream(`deflate-raw`)).getReader();',
				chunkV, '=(await ', readerV, '.read()).value;',
				evaledStringV, '+=String.fromCharCode(...', chunkV, ')',
			');',
		];

		/**
		 * Decode data as UTF-8.
		 * Longer code, but supports the entire Unicode and strings of virtually any length.
		 */
		const readAsUtf8 = [
			'for(',
				readerV, '=(await fetch`#`).body.pipeThrough(new DecompressionStream(`deflate-raw`)).pipeThrough(new TextDecoderStream).getReader();',
				chunkV, '=(await ', readerV, '.read()).value;',
				evaledStringV, '+=', chunkV,
			');',
		];

		return [
			'(',
				'async ', evaledStringV, '=>{',
					...(useCharCodes ? readAsCharCodes : readAsUtf8),
					'eval(', evaledStringV, ')',
				'}',
			')`//`',
		];
	}

	/**
	 * Characters that should be treated as a JavaScript newline.
	 */
	protected _jsNewlines(): ReadonlySet<string> {
		return new Set(['\r', '\n', '\u2028', '\u2029']);
	}

	/**
	 * A call stack size we expect from a browser
	 */
	protected _maxCallStackSize(): number {
		return 65000;
	}

	protected _generateLeadIn(template: StringTemplate): { leadIn: Uint8Array, leadInDecompressedSize: number } {
		const testByte1 = 0b10101010;
		const testByte2 = 0b01010101;
		const surrogateFinalBlock = Uint8Array.of(0x02, 0x00, 0xfd, 0xff, testByte1, testByte2);
		let bestBytes: Uint8Array | null = null;
		let bestDecompressedSize = Infinity;
		let bestFinalizedSize = Infinity;

		for (const variant of iterateThroughTemplate(template)) {
			const leadInBytes = bytesFromString(variant);
			const leadInBits = bitsFromBytes(leadInBytes);

			// The block is terminated on a special "end of block" value
			// Good news: it's a sequence of seven zero bits.
			// Bad news: we don't know exactly where to put them.
			// We just keep adding zero bits until it works.
			for (const zeroBits: 0[] = []; zeroBits.length <= 16; zeroBits.push(0)) {
				const finalizedDeflateBinary = bytesConcat(
					bytesFromBits([
						// Block type 1 introducer, not final.
						0, 1, 0,
						// The rest of the newline character (0x0A, "\n") bits
						1, 0, 0, 0, 0,
						...leadInBits,
						...zeroBits,
						// Block type 0 introducer. Final flag is set.
						1, 0, 0,
					]),
					// 4 bytes of a block-type-0 payload length
					surrogateFinalBlock
				);

				if (finalizedDeflateBinary.byteLength > bestFinalizedSize) {
					// Won't call a (potentially heavy) decompressor if this variant
					// is not better than the one we aleady have.
					continue;
				}

				let decompressedLeadIn: Uint8Array;
				try {
					// Should throw if it's an invalid DEFLATE-raw
					const decompressedJunk = this._binaryFromDeflateRaw(finalizedDeflateBinary);
					if (decompressedJunk[decompressedJunk.byteLength - 2] !== testByte1 || decompressedJunk[decompressedJunk.byteLength - 1] !== testByte2) {
						// A guard against too forgiving decompressors
						continue;
					}
					decompressedLeadIn = decompressedJunk.subarray(0, decompressedJunk.byteLength - 2);
					if (!this._isDecompressedLeadInOkay(decompressedLeadIn)) {
						continue;
					}
				} catch (e) {
					// No luck
					continue;
				}

				if (decompressedLeadIn.byteLength >= bestDecompressedSize) {
					// Prefer the shorter decompressed size
					continue;
				}

				// Commit

				bestBytes = bytesFromBits([
					0, 1, 0,
					1, 0, 0, 0, 0,
					...leadInBits,
					...zeroBits,
					// A type 0 block again, but not final this time
					0, 0, 0
				]);
				bestFinalizedSize = finalizedDeflateBinary.byteLength;
				bestDecompressedSize = decompressedLeadIn.byteLength;
			}
		}

		if (bestBytes === null) {
			throw new Error(`Could not generate a valid lead-in from this template`);
		}

		return {
			leadIn: bestBytes,
			leadInDecompressedSize: bestDecompressedSize,
		};
	}

	/** Make sure the decompressed junk won't termainate the // comment early */
	protected _isDecompressedLeadInOkay(decompressedJunk: Uint8Array): boolean {
		const jsNewlines = this._jsNewlines();
		const decompressedJunkAsString = new TextDecoder().decode(decompressedJunk);
		for (const jsNewline of jsNewlines) {
			if (decompressedJunkAsString.includes(jsNewline)) {
				return false;
			}
		}
		return true;
	}

	protected async _assemble(
		{
			leadIn, bootstrap, tail, payload,
			literalIncludesTail, literalNewline, useCharCodes,
			bestSize, leadInDecompressedSize,
		}: AssemblyParams,
	): Promise<Uint8Array | null> {
		const newlineBytes = Uint8Array.of(0x0A);
		const tailAsString = stringFromBytes(tail);

		if (!literalIncludesTail && tail.length > 1) {
			// There's no hope something longer would be generated at random
			return null;
		}

		const chunks: Uint8Array[] = [bootstrap];
		if (literalIncludesTail) {
			chunks.push(tail);
		}
		if (literalNewline) {
			chunks.push(newlineBytes);
		}

		const literalBlockContent = bytesConcat(...chunks);

		const blockHeader = Uint8Array.of(
			literalBlockContent.byteLength & 0xff, literalBlockContent.byteLength >>> 8,
			~literalBlockContent.byteLength & 0xff, ~literalBlockContent.byteLength >>> 8,
		);
		if (blockHeader.includes(0x3e)) {
			// Block header contains ">" and is closing the tag prematurely
			return null;
		}

		const literalBlock = bytesConcat(blockHeader, literalBlockContent);

		const stuffToCompress = literalNewline ? payload : bytesConcat(newlineBytes, payload);

		if (useCharCodes) {
			// Expect the decompressed data to fit in the call stack
			const uncompressedSize = leadInDecompressedSize + literalBlockContent.byteLength + stuffToCompress.byteLength;
			if (uncompressedSize > this._maxCallStackSize()) {
				return null;
			}
		}

		// We're super-lazy with the compression as it is really heavy
		const compressed = await this._deflateRawFromBinary(stuffToCompress, literalBlock);

		if (literalBlock.byteLength + compressed.byteLength >= bestSize) {
			// Return early
			return null;
		}

		if (
			!literalIncludesTail &&
			![0x27, 0x22, 0x20, 0x0d, 0x0a, 0x09].includes(literalBlock[literalBlock.byteLength - 1]) &&
			![0x3e, 0x20, 0x0d, 0x0a, 0x09].includes(compressed[0])
		) {
			// We've just concatenated random garbage to the tag name or attr value
			return null;
		}

		if (!literalIncludesTail) {
			// Expect the ">" to appear in the compressed binary at pure chance
			const compressedAsString = new TextDecoder().decode(compressed);
			const tagEndIndex = findTagEnd(compressedAsString);
			if (tagEndIndex === -1 || !compressedAsString.slice(tagEndIndex).startsWith(tailAsString)) {
				return null;
			}
		}

		return bytesConcat(leadIn, literalBlock, compressed);
	}

	public async crunch(payload: string | Uint8Array): Promise<Uint8Array>;
	// Overload for the sick sad untyped JavaScript world
	public async crunch(payload: unknown): Promise<Uint8Array> {
		let payloadAsString: string | undefined;
		let payloadAsUtf8Bytes: Uint8Array | null = null;

		if (typeof payload === 'string') {
			payloadAsString = payload;
		} else if (payload instanceof Uint8Array) {
			payloadAsUtf8Bytes = payload;
		} else {
			throw new TypeError('crunch() accepts only strings and Uint8Array instances');
		}

		const { ir, ids } = irFromHtml(this._htmlTemplate());

		let bestOutput: Uint8Array | null = null;

		for (const useCharCodes of [true, false]) {
			let payloadBytes: Uint8Array | null = null;
			if (useCharCodes) {
				payloadAsString ??= stringFromBytes(payloadAsUtf8Bytes!);
				if (payloadAsString.length >= this._maxCallStackSize()) {
					// The payload is too long, even without bootstrap
					continue;
				}
				payloadBytes = charCodeBytesFromString(payloadAsString);
				if (payloadBytes === null) {
					// Not all codePoints could be represented
					continue;
				}
			} else {
				payloadAsUtf8Bytes ??= bytesFromString(payloadAsString!);
				payloadBytes = payloadAsUtf8Bytes;
			}

			const onloadTemplate = this._onloadAttribute(useCharCodes, { reservedIdentifierNames: ids });
			const templates = templatesFromIr(ir, onloadTemplate);
			const { leadIn, leadInDecompressedSize } = this._generateLeadIn(templates.templateHead);
			const bootstrap = Uint8Array.from(bytesFromTemplate(templates.templateMid, payloadBytes));
			const tail = Uint8Array.from(bytesFromTemplate(templates.templateTail, payloadBytes));

			for (let literalNewline of [true, false])
			for (let literalIncludesTail of [true, false]) {
				const bestSize: number = (bestOutput === null ? Infinity : bestOutput.byteLength);
				const output = await this._assemble({
					leadIn, bootstrap, tail,
					payload: payloadBytes,
					literalIncludesTail, literalNewline, useCharCodes,
					leadInDecompressedSize,
					bestSize,
				});

				bestOutput = output ?? bestOutput;
			}

			if (bestOutput !== null) {
				// Retrying with a longer bootstrap would be a waste of time
				return bestOutput;
			}
		}

		throw new Error('Could not generate bootstrap');
	}
}