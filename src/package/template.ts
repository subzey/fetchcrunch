import { Tokenizer } from 'parse5';

export type StringTemplateVariants = Set<string> & {
	mutuallyExclusiveWith?: StringTemplateVariants[];
}

export type StringTemplateLiteral = string;

export type StringTemplateItem = StringTemplateVariants | StringTemplateLiteral;

export type StringTemplate = StringTemplateItem[];

interface IntermediateRepresentationItem {
	kind: 'unknown' | 'tag-name-or-attr-name' | 'attr-value' | 'onload-attr-value' | 'attr-separator' | 'close-waka';
	value: string;
}

export type IR = readonly IntermediateRepresentationItem[];

export const BOOTSTRAP_ATTR_VALUE = '__bootstrap__';

export function irFromHtml(html: string): { ir: IR, ids: ReadonlySet<string> } {
	const ir: IntermediateRepresentationItem[] = [];
	const ids: Set<string> = new Set();

	/**
	 * Anything but the tags is just copied as is
	 */
	function copyAsIs(token: { location: null | { startOffset: number, endOffset: number}}) {
		if (!token.location) {
			throw new Error('Token should include its location');
		}
		ir.push({
			kind: 'unknown',
			value: html.slice(token.location.startOffset, token.location.endOffset),
		});
	}

	const tokenizer = new Tokenizer(
		{ sourceCodeLocationInfo: true },
		{
			onCharacter: copyAsIs,
			onComment: copyAsIs,
			onDoctype: copyAsIs,
			onStartTag(token) {
				ir.push({ kind: 'tag-name-or-attr-name', value: '<' + token.tagName });
				for (const attr of token.attrs) {
					if (attr.name === 'id' && attr.value) {
						// Ids are implicit globals
						ids.add(attr.value);
					}
					if (token.tagName === 'svg' && attr.value === BOOTSTRAP_ATTR_VALUE) {
						// Those are not ids, but still cannot be used in <svg on* >
						ids.add('x');
						ids.add('y');
					}

					ir.push({ kind: 'attr-separator', value: ' '});
					if (attr.value === BOOTSTRAP_ATTR_VALUE) {
						ir.push({ kind: 'tag-name-or-attr-name', value: attr.name + '=' });
						ir.push({ kind: 'onload-attr-value', value: attr.value });
					} else if (attr.value) {
						ir.push({ kind: 'tag-name-or-attr-name', value: attr.name + '=' });
						ir.push({ kind: 'attr-value', value: attr.value });
					} else {
						ir.push({ kind: 'tag-name-or-attr-name', value: attr.name });
					}
				}
				ir.push({ kind: 'close-waka', value: '>' });
			},
			onEndTag(token) {
				ir.push({ kind: 'tag-name-or-attr-name', value: '</' + token.tagName });
				ir.push({ kind: 'close-waka', value: '>' });
			},
			onEof() { /* nothing */ },
			onWhitespaceCharacter: copyAsIs,
			onNullCharacter: copyAsIs
		}
	);
	tokenizer.write(html, true);

	return { ir, ids };
}

export function templatesFromIr(ir: IR, onloadTemplate: StringTemplate): {
	templateHead: StringTemplate;
	templateMid: StringTemplate;
	templateTail: StringTemplate;
} {
	let firstSplitIndex: number | undefined = -1;
	let secondSplitIndex: number | undefined = -1;
	for (let i = 0; i < ir.length; i++) {
		if (firstSplitIndex === -1) {
			if (ir[i].kind === 'close-waka' || ir[i].kind === 'attr-separator') {
				firstSplitIndex = i;
			}
		}
		if (ir[i].kind === 'close-waka') {
			secondSplitIndex = i;
		}
	}

	if (firstSplitIndex === -1 || secondSplitIndex === -1) {
		throw new Error('The template should contain at least one closed tag');
	}

	const head = ir.slice(0, firstSplitIndex);
	const mid = ir.slice(firstSplitIndex, secondSplitIndex);
	const tail = ir.slice(secondSplitIndex);

	head.push({ kind: 'attr-separator', 'value': ' '});

	if (mid.filter(item => item.kind === 'onload-attr-value').length !== 1) {
		throw new Error(`The template should contain one attribute with the value "${ BOOTSTRAP_ATTR_VALUE }"`);
	}

	return {
		templateHead: stringTemplateFromIr(head),
		templateMid: stringTemplateFromIr(mid, onloadTemplate),
		templateTail: stringTemplateFromIr(tail)
	};
}

function templateItemFromAttrValue(attrValue: string): { template: StringTemplateItem[]; needsSeparator: boolean } {
	if (testHtmlAttr(attrValue, attrValue)) {
		// No escaping nor wrapping needed
		return {
			template: [attrValue],
			needsSeparator: true,
		}
	}

	if (!/['"&]/.test(attrValue)) {
		// No special precautions
		const quote = new Set(`"'`);
		return {
			template: [quote, attrValue, quote],
			needsSeparator: false,
		};
	}
	
	const strictlyEscapedValue = attrValue.replace(/['"&]/g, (s: string) => `&#${s.charCodeAt(0)};`);
	const usingSingleQuote = sloppyEscaped(`'${strictlyEscapedValue}'`, attrValue);
	const usingDoubleQuote = sloppyEscaped(`"${strictlyEscapedValue}"`, attrValue);

	if (usingSingleQuote.slice(1, usingSingleQuote.length - 1) === usingDoubleQuote.slice(1, usingDoubleQuote.length - 1)) {
		const quote = new Set(`"'`);
		return {
			template: [quote, usingSingleQuote.slice(1, usingSingleQuote.length - 1), quote],
			needsSeparator: false,
		}
	}

	return {
		template: [usingSingleQuote.length < usingDoubleQuote.length ? usingSingleQuote : usingDoubleQuote],
		needsSeparator: false,
	};
}


// It's a bit heavy, but is precise
function testHtmlAttr(attrHtmlChunk: string, shouldBe: string): boolean {
	const noop = (): void => {};

	const tagTokens: {attrs: {name: string, value: string}[]}[] = [];

	const tokenizer = new Tokenizer({}, {
		onCharacter: noop,
		onComment: noop,
		onDoctype: noop,
		onEndTag: noop,
		onEof: noop,
		onNullCharacter: noop,
		onWhitespaceCharacter: noop,
		onParseError: noop,
		onStartTag: (token) => {
			tagTokens.push(token);
		},
	});

	tokenizer.write(`<i data-test=${attrHtmlChunk}>`, true);

	return (tagTokens.length === 1 && tagTokens[0].attrs.length === 1 && tagTokens[0].attrs[0].value === shouldBe);
}

function sloppyEscaped(attrHtmlChunk: string, shouldBe: string) {
	return attrHtmlChunk.replace(/&#(\d+);/g, (s: string, d: string, index: number, entireString: string): string => {
		const variants = [String.fromCharCode(Number(d))];
		if (Number(d) === 38) {
			variants.push('&amp');
			variants.push('&AMP');
		}
		variants.push(`&#${d}`);
		for (const variant of variants) {
			if (testHtmlAttr(entireString.slice(0, index) + variant + entireString.slice(index + s.length), shouldBe)) {
				return variant;
			}
		}
		return s;
	});
}

function stringTemplateFromIr(ir: IntermediateRepresentationItem[], onloadTemplate?: StringTemplate): StringTemplate {
	const rv: StringTemplateItem[] = [];
	const attrSeparators = ' \n\r\t/';
	let skipSeparatorNextTime = false;

	for (let i = 0; i < ir.length; i++) {
		const irItem = ir[i];
		const skipSeparatorThisTime = skipSeparatorNextTime;
		skipSeparatorNextTime = false;

		if (irItem.kind === 'close-waka' || irItem.kind === 'unknown') {
			rv.push(irItem.value); // as literal
			continue;
		}
		if (irItem.kind === 'attr-value') {
			const { template, needsSeparator } = templateItemFromAttrValue(irItem.value);
			skipSeparatorNextTime = !needsSeparator;
			rv.push(...template);
			continue
		}
		if (irItem.kind === 'onload-attr-value') {
			const quote = new Set(`"'`);
			if (onloadTemplate === undefined) {
				throw new Error('Unexpected onload template insertion point');
			}
			skipSeparatorNextTime = true;
			rv.push(quote, ...onloadTemplate, quote);
		}
		if (irItem.kind === 'tag-name-or-attr-name') {
			for (const ch of irItem.value) {
				const set = new Set([ch, ch.toUpperCase(), ch.toLowerCase()]);
				rv.push(set.size === 1 ? ch : set);
			}
			continue;
		}
		if (irItem.kind === 'attr-separator') {
			if (!skipSeparatorThisTime) {
				rv.push(new Set(attrSeparators));
			}
			continue;
		}
	}
	return rv;
}


export function iterateThroughTemplate(template: StringTemplate): IterableIterator<string> {
	return _iterateThroughTemplate(template, 0, '');
}

function * _iterateThroughTemplate(template: StringTemplate, index: number, prefix: string): IterableIterator<string> {
	if (index === template.length) {
		yield prefix;
		return;
	}
	const templateItem = template[index];
	if (typeof templateItem === 'string') {
		yield * _iterateThroughTemplate(template, index + 1, prefix + templateItem);
		return;
	}
	for (const variant of templateItem) {
		yield * _iterateThroughTemplate(template, index + 1, prefix + variant);
	}
}