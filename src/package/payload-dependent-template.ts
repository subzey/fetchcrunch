import { bytesFromString } from './junkyard.js';
import type { StringTemplate, StringTemplateVariants } from './template.js';

export type BytesTemplate = (number | BytesTemplateVariants)[];

export type BytesTemplateVariants = Set<number> & {
	mutuallyExclusiveWith?: BytesTemplateVariants[];
}


interface Match {
	replaceWith: number;
	matchedSet: BytesTemplateVariants;
	size: number;
}
/**
 * Picks template parts out of the available variants (like variable names or quotes) using the payload contents.
 * 
 * Ex.: `s=>42 ... s=>42` would be compressed better than `s=>42 ... t=>42`
 * 
 * The template may include numbers or `Set`s of numbers.
 * A number is treated a fixed literal values.
 * A set defines possible byte values (no utf-8 support so far) to pick from.
 * A set may occur several times. All the entries will be replaced with the same value.
 * If some value is picked for one set the others cannot use it. It prevents picking the same varname for different variables.
 * @param template Template to use
 * @param referenceArr Payload to pick values from
 * @param minRefSize Matches smaller than that doesn't count as matches. Default is 3 that is the min backref size in DEFLATE
 * @param maxDistance Matches more distant than that doesn't count as matches. Default is 32768 that is the max backref distance in DEFLATE
 * @returns bytes
 */
export function bytesFromTemplate(stringTemplate: StringTemplate, referenceArr: ArrayLike<number>, minRefSize=3, maxDistance=32768): number[] {
	const templateArr = internalizeTemplate(stringTemplate);
	while (true) {
		let bestMatch: Match | null = null;
		for (let templateOffset = templateArr.length; templateOffset-- > 0;) {
			const v = templateArr[templateOffset];
			if (typeof v === 'number') {
				continue;
			}
			if (v.size === 0) {
				throw new Error('The template includes a set of zero size');
			}
			bestMatch ??= {
				replaceWith: Array.from(v)[0],
				matchedSet: v,
				size: 0,
			};
			for (const match of findMatches(referenceArr, templateArr, templateOffset, minRefSize, maxDistance - templateArr.length + templateOffset)) {
				if (match.size > bestMatch.size) {
					bestMatch = match;
				}
			}
		}

		if (bestMatch === null) {
			return templateArr as number[];
		}

		collapseSet(templateArr, bestMatch.matchedSet, bestMatch.replaceWith);
	}
}

function * findMatches(referenceArr: ArrayLike<number>, templateArr: BytesTemplate, templateOffset: number, minSize: number, maxDistance: number): Generator<Match> {
	const anchorSet = templateArr[templateOffset] as BytesTemplateVariants;
	const maxOffset = Math.min(referenceArr.length - 1, maxDistance);
	for (let referenceOffset = 0; referenceOffset <= maxOffset; referenceOffset++) {
		if (!anchorSet.has(referenceArr[referenceOffset])) {
			continue;
		}
		const offsetDelta = templateOffset - referenceOffset;
		let matchSize = 1;
		// Trying backwards
		for (let tryReferenceOffset = referenceOffset - 1; tryReferenceOffset >= 0; tryReferenceOffset--) {
			if (matchesAt(
				referenceArr, tryReferenceOffset,
				templateArr, offsetDelta + tryReferenceOffset
			)) {
				matchSize++;
			} else {
				break;
			}
		}
		// Trying forwards
		for (let tryReferenceOffset = referenceOffset + 1; tryReferenceOffset <= maxOffset; tryReferenceOffset++) {
			if (matchesAt(
				referenceArr, tryReferenceOffset,
				templateArr, offsetDelta + tryReferenceOffset
			)) {
				matchSize++;
			} else {
				break;
			}
		}
		if (matchSize < minSize) {
			continue;
		}
		yield {
			size: matchSize,
			matchedSet: anchorSet,
			replaceWith: referenceArr[referenceOffset],
		};
	}
}

function matchesAt(
	referenceArr: ArrayLike<number>, referenceOffset: number,
	templateArr: (number | ReadonlySet<number>)[], templateOffset: number
): boolean {
	if (referenceOffset < 0 || templateOffset < 0 || referenceOffset >= referenceArr.length || templateOffset >= templateArr.length) {
		return false;
	}
	const templateByte = templateArr[templateOffset];
	if (typeof templateByte === 'number') {
		return referenceArr[referenceOffset] === templateByte;
	} else {
		return templateByte.has(referenceArr[referenceOffset]);
	}
}

function collapseSet(templateArr: BytesTemplate, replaceSet: BytesTemplateVariants, replaceWith: number): void {
	for (let i = 0; i < templateArr.length; i++) {
		let v = templateArr[i];
		if (typeof v === 'number') {
			continue;
		}
		if (v === replaceSet) {
			// Replace all occurences of this set with the same value
			templateArr[i] = replaceWith;
			continue;
		}
	}
	if (replaceSet.mutuallyExclusiveWith) {
		for (const otherSet of replaceSet.mutuallyExclusiveWith) {
			otherSet.delete(replaceWith);
		}
	}
}


function internalizeTemplate(stringTemplate: StringTemplate): BytesTemplate {
	const setMapping: Map<StringTemplateVariants, BytesTemplateVariants> = new Map();
	const rv: BytesTemplate = [];
	for (const item of stringTemplate) {
		if (typeof item === 'string') {
			rv.push(...bytesFromString(item));
			continue;
		}

		let bytesSet = setMapping.get(item);
		if (bytesSet === undefined) {
			bytesSet = bytesSetFromStringSet(item);
			setMapping.set(item, bytesSet);
		}
		rv.push(bytesSet);
	}

	// Restore mutual exclusiveness
	for (const stringSet of setMapping.keys()) {
		if (stringSet.mutuallyExclusiveWith === undefined) {
			continue;
		}
		const binarySet = setMapping.get(stringSet)!;
		for (const referencedStringSet of stringSet.mutuallyExclusiveWith) {
			const referencedBinarySet = setMapping.get(referencedStringSet);
			if (referencedBinarySet === undefined) {
				continue
			}
			binarySet.mutuallyExclusiveWith ??= [];
			binarySet.mutuallyExclusiveWith.push(referencedBinarySet);
			referencedBinarySet.mutuallyExclusiveWith ??= [];
			referencedBinarySet.mutuallyExclusiveWith.push(binarySet);
		}
	}

	return rv;
}

function bytesSetFromStringSet(stringSet: Set<string>): Set<number> {
	const bytesSet: Set<number> = new Set();
	for (const ch of stringSet) {
		const charCode = ch.charCodeAt(0);
		if (ch.length > 1 || charCode > 127) {
			throw new Error('The template variant should be a basic ASCII character');
		}
		bytesSet.add(charCode);
	}
	return bytesSet;
}