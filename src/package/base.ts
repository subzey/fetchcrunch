import { bitsFromBytes, bytesFromBits, bytesConcat, findTagEnd, bytesFromString, stringFromBytes } from "./junkyard.js";
import { bytesFromTemplate } from "./payload-dependent-template.js";
import { StringTemplate, StringTemplateVariants, irFromHtml, templatesFromIr, iterateThroughTemplate } from "./template.js";

export interface Options {
	head?: string;
	tail?: string;
}

interface AssemblyVariant {
	literalNewline: boolean;
	literalIncludesTail: boolean;
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
		return '<svg onload>';
	}

	protected _onloadAttribute(reservedIdentifierNames: ReadonlySet<string>): StringTemplate {
		const identifierNames = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_';
		const identifiers: StringTemplateVariants[] = [
			new Set('s' + identifierNames),
			new Set('r' + identifierNames),
			new Set('c' + identifierNames),
		];
		for (const identifier of identifiers) {
			for (const reservedIdentifierName of reservedIdentifierNames) {
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

		return [
			'(',
				'async ', evaledStringV, '=>{',
					'for(',
						readerV, '=(await fetch`#`).body.pipeThrough(new DecompressionStream(`deflate-raw`)).pipeThrough(new TextDecoderStream).getReader();',
						chunkV, '=(await ', readerV, '.read()).value;',
						evaledStringV, '+=', chunkV,
					');',
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

	protected _generateLeadIn(template: StringTemplate): Uint8Array {
		const zeroLengthFinalBlock = Uint8Array.of(0x00, 0x00, 0xff, 0xff);
		let bestBytes: Uint8Array | null = null;
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
			throw new Error(`Could not generate a valid lead-in from this template`);
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

	protected * _assemblyVariants(): Iterable<AssemblyVariant> {
		for (let literalNewline of [true, false]) {
			for (let literalIncludesTail of [true, false]) {
				yield {
					literalNewline,
					literalIncludesTail,
				}
			}
		}
	}

	protected async _assemble(leadIn: Uint8Array, bootstrap: Uint8Array, tail: Uint8Array, payload: Uint8Array) {
		const newlineBytes = Uint8Array.of(0x0A);
		const tailAsString = stringFromBytes(tail);

		let bestResult: Uint8Array | null = null;

		for (const assemblyVariant of this._assemblyVariants()) {
			if (!assemblyVariant.literalIncludesTail && tail.length > 1) {
				// There's no hope something longer would be generated at random
				continue;
			}

			const chunks: Uint8Array[] = [bootstrap];
			if (assemblyVariant.literalIncludesTail) {
				chunks.push(tail);
			}
			if (assemblyVariant.literalNewline) {
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

			const stuffToCompress = assemblyVariant.literalNewline ? payload : bytesConcat(newlineBytes, payload);
			// We're super-lazy with the compression as it is really heavy
			const compressed = await this._deflateRawFromBinary(stuffToCompress, literalBlock);

			if (bestResult !== null && literalBlock.byteLength + compressed.byteLength > bestResult.byteLength) {
				continue;
			}

			if (!assemblyVariant.literalIncludesTail) {
				const compressedAsString = new TextDecoder().decode(compressed);
				const tagEndIndex = findTagEnd(compressedAsString);
				if (tagEndIndex === -1 || !compressedAsString.slice(tagEndIndex).startsWith(tailAsString)) {
					continue;
				}
			}

			bestResult = bytesConcat(leadIn, literalBlock, compressed);
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

		const { ir, ids } = irFromHtml(this._htmlTemplate());
		const onloadTemplate = this._onloadAttribute(ids);
		const templates = templatesFromIr(ir, onloadTemplate);
		const leadIn = this._generateLeadIn(templates.templateHead);
		const bootstrap = Uint8Array.from(bytesFromTemplate(templates.templateMid, payloadBytes));
		const tail = Uint8Array.from(bytesFromTemplate(templates.templateTail, payloadBytes));

		return this._assemble(leadIn, bootstrap, tail, payloadBytes);
	}
}