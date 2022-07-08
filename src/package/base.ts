import { bitsFromBytes, bytesFromBits, bytesConcat, htmlVariants, findTagEnd, bytesFromString } from "./junkyard.js";
import { bytesFromTemplate, Template } from "./payload-dependent-template.js";

export interface Options {
	head?: string;
	tail?: string;
}

/**
 * A base class that works in node, browser and deno 
 */
export abstract class FetchCrunchBase {
	private _leadIn: null | Uint8Array = null;

	/** Implement me! */
	protected abstract _binaryFromDeflateRaw(compressed: Uint8Array): Uint8Array;
	/** Implement me! */
	protected abstract _deflateRawFromBinary(source: Uint8Array, dictionary: Uint8Array): Uint8Array | Promise<Uint8Array>;

	protected _templateHead(): string {
		return '<svg ';
	}

	protected _templateTail(): string {
		return '>';
	}

	protected _jsEvalAttribute(payload: ArrayLike<number>): Uint8Array {
		const identifierStart = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_';
		const quote = new Set(bytesFromString(`"'`));
		const evaledStringV = new Set(bytesFromString('s' + identifierStart));
		const readerV = new Set(bytesFromString('r' + identifierStart));
		const chunkV = new Set(bytesFromString('c' + identifierStart));

		// TODO: mutually exclusive

		const template: (number | Set<number>)[] = [];
		for (const v of [
			' onload=', quote,
				'(',
					'async ', evaledStringV, '=>{',
						'for(',
							readerV, '=(await fetch``).body.pipeThrough(new DecompressionStream(`deflate-raw`)).pipeThrough(new TextDecoderStream).getReader();',
							chunkV, '=(await ', readerV, '.read()).value;',
							evaledStringV, '+=', chunkV,
						');',
						'eval(', evaledStringV, ')',
					'}',
				')`//`',
			quote
		]) {
			if (typeof v === 'string') {
				template.push(...bytesFromString(v))
			} else {
				template.push(v);
			}
		}

		return Uint8Array.from(bytesFromTemplate(template, payload));
	}

	/** 
	 * Possible HTML attribute separators in the order of preference.
	 * Override this if you have some other preferences.
	 */
	protected _htmlAttributeSeparators(): ReadonlySet<string> {
		return new Set([' ', '\t', '\n', '/', '\r']);
	}

	/**
	 * Characters that should be treated as a JavaScript newline.
	 */
	protected _jsNewlines(): ReadonlySet<string> {
		return new Set(['\r', '\n', '\u2028', '\u2029']);
	}

	protected _generateLeadIn(leadInHtml: string): Uint8Array {
		const zeroLengthFinalBlock = Uint8Array.of(0x00, 0x00, 0xff, 0xff);
		let bestBytes: Uint8Array | null = null;
		let bestFinalizedSize = Infinity;

		for (const variant of htmlVariants(leadInHtml, this._htmlAttributeSeparators())) {
			const leadInBytes = new TextEncoder().encode(variant);
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
					zeroLengthFinalBlock
				);

				if (finalizedDeflateBinary.byteLength >= bestFinalizedSize) {
					// Won't call a (potentially heavy) decompressor if this variant
					// is not better than the one we aleady have.
					continue;
				}

				try {
					// Should throw if it's an invalid DEFLATE-raw
					const decompressedJunk = this._binaryFromDeflateRaw(finalizedDeflateBinary);
					if (!this._isDecompressedJunkOkay(decompressedJunk)) {
						continue;
					}
				} catch (e) {
					// No luck
					continue;
				}

				bestBytes = bytesFromBits([
					0, 1, 0,
					1, 0, 0, 0, 0,
					...leadInBits,
					...zeroBits,
					// A type 0 block again, but not final this time
					0, 0, 0
				]);
				bestFinalizedSize = finalizedDeflateBinary.byteLength;
			}
		}

		if (bestBytes === null) {
			throw new Error(`Could not generate a valid lead-in from this HTML: ${leadInHtml}`);
		}

		return bestBytes;
	}

	/** Make sure the decompressed junk won't termainate the // comment early */
	protected _isDecompressedJunkOkay(decompressedJunk: Uint8Array): boolean {
		const jsNewlines = this._jsNewlines();
		const decompressedJunkAsString = new TextDecoder().decode(decompressedJunk);
		for (const jsNewline of jsNewlines) {
			if (decompressedJunkAsString.includes(jsNewline)) {
				return false;
			}
		}
		return true;
	}

	protected async _generateBootstrapAndPayload(payload: Uint8Array) {
		const evalAttributeBytes = this._jsEvalAttribute(payload);
		const templateTail = this._templateTail();
		const templateTailBytes = new TextEncoder().encode(templateTail);
		const newlineBytes = Uint8Array.of(0x0A);

		let bestResult: Uint8Array | null = null;

		for (let literalIncludesNewline of [true, false]) {
			for (let literalIncludesTail of [true, false]) {

				if (!literalIncludesTail) {
					if (templateTail !== '>') {
						// There's no hope something longer would be generated at random
						continue;
					}
				}

				const chunks: Uint8Array[] = [evalAttributeBytes];
				if (literalIncludesTail) {
					chunks.push(templateTailBytes);
				}
				if (literalIncludesNewline) {
					chunks.push(newlineBytes);
				}

				const literalBlockContent = bytesConcat(...chunks);

				const blockHeader = Uint8Array.of(
					literalBlockContent.byteLength & 0xff, literalBlockContent.byteLength >>> 8,
					~literalBlockContent.byteLength & 0xff, ~literalBlockContent.byteLength >>> 8,
				);
				if (blockHeader.includes(0x3e)) {
					// Block header contains ">" and is closing the tag prematurely
					continue;
				}

				const literalBlock = bytesConcat(blockHeader, literalBlockContent);

				const stuffToCompress = literalIncludesNewline ? payload : bytesConcat(newlineBytes, payload);
				// We're super-lazy with the compression as it is really heavy
				const compressed = await this._deflateRawFromBinary(stuffToCompress, literalBlock);

				if (bestResult !== null && literalBlock.byteLength + compressed.byteLength > bestResult.byteLength) {
					continue;
				}

				if (!literalIncludesTail) {
					const compressedAsString = new TextDecoder().decode(compressed);
					const tagEndIndex = findTagEnd(compressedAsString);
					if (tagEndIndex === -1 || !compressedAsString.slice(tagEndIndex).startsWith(templateTail)) {
						continue;
					}
				}

				bestResult = bytesConcat(literalBlock, compressed);
			}
		}

		if (bestResult === null) {
			throw new Error('Could not generate bootstrap');
		}

		return bestResult;
	}

	public async crunch(payload: string | Uint8Array): Promise<Uint8Array>;
	// Overload for the sick sad untyped JavaScript world
	public async crunch(payload: unknown): Promise<Uint8Array> {
		let payloadBytes: Uint8Array;
		if (typeof payload === 'string') {
			payloadBytes = new TextEncoder().encode(payload);
		} else if (payload instanceof Uint8Array) {
			payloadBytes = payload;
		} else {
			throw new TypeError('crunch() accepts only strings and Uint8Array instances');
		}

		this._leadIn ??= this._generateLeadIn(this._templateHead());
		const bootstrapAndPayload = await this._generateBootstrapAndPayload(payloadBytes);

		return bytesConcat(this._leadIn, bootstrapAndPayload);
	}
}