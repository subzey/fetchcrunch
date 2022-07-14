import { parse, parseFragment, DefaultTreeAdapterMap } from 'parse5';

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

export function irFromHtml(html: string): { ir: IR, ids: ReadonlySet<string> } {
	const doc: DefaultTreeAdapterMap['document'] = parse(html, { sourceCodeLocationInfo: true });
	return {
		ir: Array.from(irFromConcreteTree(html, doc)),
		ids: new Set(collectIds(doc)),
	};
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
		throw new Error('The template should contain exactly one onload attribute');
	}

	return {
		templateHead: stringTemplateFromIr(head),
		templateMid: stringTemplateFromIr(mid, onloadTemplate),
		templateTail: stringTemplateFromIr(tail)
	};
}

function * collectIds(node: DefaultTreeAdapterMap['node']): Iterable<string> {
	if ('tagName' in node) {
		for (const { name, value } of node.attrs) {
			if (name === 'id') {
				yield value;
			}
		}
	}
	if ('childNodes' in node) {
		for (const child of node.childNodes) {
			yield * collectIds(child);
		}
	}
}

function * irFromConcreteTree(html: string, node: DefaultTreeAdapterMap['node'] | DefaultTreeAdapterMap['parentNode']): Iterable<IntermediateRepresentationItem> {
	if (('tagName' in node) && node.sourceCodeLocation) {
		// An element that was mentioned in the template (not implicitly created)
		yield {
			kind: 'tag-name-or-attr-name',
			value: '<' + node.tagName,
		}
		for (const attr of node.attrs) {
			yield {
				kind: 'attr-separator',
				value: ' ',
			}
			yield {
				kind: 'tag-name-or-attr-name',
				value: attr.name,
			}
			if (attr.name === 'onload') {
				yield {
					kind: 'tag-name-or-attr-name',
					value: '=',
				}
				yield {
					kind: 'onload-attr-value',
					value: '<onload>',
				}
			} else if (attr.value) {
				yield {
					kind: 'tag-name-or-attr-name',
					value: '=',
				}
				yield {
					kind: 'attr-value',
					value: attr.value,
				}
			}
		}
		yield {
			kind: 'close-waka',
			value: '>',
		}

		for (const child of node.childNodes) {
			yield * irFromConcreteTree(html, child);
		}

		if (node.sourceCodeLocation.endTag) {
			yield {
				kind: 'tag-name-or-attr-name',
				value: '</' + node.tagName,
			}
			yield {
				kind: 'close-waka',
				value: '>',
			}
		}

		return;
	}

	if (node.sourceCodeLocation) {
		// Something else that was mentioned in the template
		yield {
			kind: 'unknown',
			value: html.substring(node.sourceCodeLocation.startOffset, node.sourceCodeLocation.endOffset)
		}
		return;
	}

	if ('childNodes' in node) {
		// Something automatically created:
		// Just traverse if traverable
		for (const child of node.childNodes) {
			yield * irFromConcreteTree(html, child);
		}
	}
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
	const frag = parseFragment(`<i x=${attrHtmlChunk}>`);
	const attr = (frag.childNodes[0] as DefaultTreeAdapterMap['element']).attrs[0];
	if (!attr) {
		return false;
	}
	if (attr.name !== 'x') {
		return false;
	}
	if (attr.value !== shouldBe) {
		return false;
	}
	return true;
}

function sloppyEscaped(attrHtmlChunk: string, shouldBe: string) {
	return attrHtmlChunk.replace(/&#(\d+);/g, (s: string, d: string, index: number, entireString: string): string => {
		const variants = [String.fromCharCode(Number(d))];
		if (Number(d) === 38) {
			variants.push('&amp');
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