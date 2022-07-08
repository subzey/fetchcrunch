export type Template = Iterable<number | ReadonlySet<number>> | ArrayLike<number | ReadonlySet<number>>;

interface Match {
	replaceWith: number;
	matchedSet: ReadonlySet<number>;
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
export function bytesFromTemplate(template: Template, referenceArr: ArrayLike<number>, minRefSize=3, maxDistance=32768): number[] {
	let templateArr = Array.from(template);
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

function * findMatches(referenceArr: ArrayLike<number>, templateArr: (number | ReadonlySet<number>)[], templateOffset: number, minSize: number, maxDistance: number): Generator<Match> {
	const anchorSet = templateArr[templateOffset] as ReadonlySet<number>;
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

function collapseSet(templateArr: (number | ReadonlySet<number>)[], replaceSet: ReadonlySet<number>, replaceWith: number): void {
	const replacementMapping: Map<ReadonlySet<number>, ReadonlySet<number>> = new Map();

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
		if (v.has(replaceWith)) {
			// Remove this value from other sets
			// (actually creating a new one, because it's a ReadonlySet)
			if (!replacementMapping.has(v)) {
				const patchedSet = new Set(v);
				patchedSet.delete(replaceWith);
				replacementMapping.set(v, patchedSet);
			}
			templateArr[i] = replacementMapping.get(v) as ReadonlySet<number>;
		}
	}
}
