import './main.css';

let currentWorker: Worker | null = null;
let workerIsIdle = false;
function crunch(params: { source: string, iterations?: number, template?: string }): Promise<Uint8Array> {
	return new Promise((r, rj) => {
		if (currentWorker && !workerIsIdle) {
			currentWorker.terminate();
			currentWorker = null;
		}
		if (currentWorker === null) {
			currentWorker = new Worker(
				/* webpackChunkName: 'crunch-worker' */
				new URL('./worker', import.meta.url),
				{ name: 'Crunch worker' }
			);
		}
		workerIsIdle = false;
		const worker = currentWorker;
		worker.onerror = (e: ErrorEvent) => {
			if (worker !== currentWorker) {
				return;
			}
			rj(e);
		}
		worker.onmessageerror = () => {
			if (worker !== currentWorker) {
				return;
			}
			rj(new Error('messageerror'));
		}
		worker.onmessage = (e: MessageEvent) => {
			if (worker !== currentWorker) {
				return;
			}
			if (e.data.result) {
				workerIsIdle = true;
				r(e.data.result as Uint8Array);
			} else {
				rj(new Error(e.data.errorMessage ?? 'Unknown error'));
			}
		}
		worker.postMessage(params);
	});
}

{
	document.querySelector('#load-jquery')!.addEventListener('click', async (e) => {
		e.preventDefault();
		const res = await fetch('https://code.jquery.com/jquery-3.6.0.min.js');
		if (!res.ok) {
			throw new Error(`Not ok: ${res.status}`);
		}
		const text = await res.text();
		const inputElement = document.querySelector('#input' as 'input')!;
		if (inputElement.value === '') {
			inputElement.value = text;
		}
	});
}

{
	document.querySelector('#paste')!.addEventListener('click', async (e) => {
		e.preventDefault();
		const text = await navigator.clipboard.readText();
		const inputElement = document.querySelector('#input' as 'input')!;
		if (inputElement.value === '') {
			inputElement.value = text;
		}
	});
}

function readInputsFromUI() {
	let source = document.querySelector('#input' as 'input')!.value;
	source = source.replace(/^[\s;]+/, '').replace(/[\s;]+$/, '');

	if (source === '') {
		throw new Error('Please type or paste something');
	}

	const template: string | undefined = document.querySelector('#template' as 'input')!.value.trim() || undefined;
	const iterationsStr = document.querySelector('#iterations' as 'input')!.value.trim();

	let iterations: number | undefined = undefined;
	if (iterationsStr !== '') {
		iterations = Math.ceil(Number(iterationsStr));
		if (!Number.isFinite(iterations) || iterations <= 0) {
			throw new RangeError('The number of iterations should be a positive integer');
		}
	}
	return { source, template, iterations }
}

{
	document.querySelector('form')!.addEventListener('submit', async (e) => {
		e.preventDefault();

		const output = document.querySelector('#output-section output')!;
		output.textContent = 'Crunching...';
		try {
			const result = await crunch(readInputsFromUI());
			const dateCreated = new Date();
			const blob = new Blob([result], { type: 'text/html;charset=utf-8' });
			const blobHref = URL.createObjectURL(blob);

			const link = document.createElement('a');
			link.target = '_blank';
			link.textContent = 'Preview';
			link.href = blobHref;
			
			const button = document.createElement('button');
			button.type = 'button';
			button.textContent = 'Download';
			button.addEventListener('click', (e) => {
				e.preventDefault();
				const link = document.createElement('a');
				link.href = blobHref;
				const basename = [
					'crunch',
					`${dateCreated.getFullYear()}-${String(dateCreated.getMonth() + 1).padStart(2, '0')}-${String(dateCreated.getDate()).padStart(2, '0')}`,
					`${String(dateCreated.getHours()).padStart(2, '0')}-${String(dateCreated.getMinutes()).padStart(2, '0')}-${String(dateCreated.getSeconds()).padStart(2, '0')}`
				].join('_');
				link.download = `${basename}.html`;
				link.click();
			});
		
			output.textContent = `${result.byteLength} bytes. `;
			output.appendChild(link);
			output.appendChild(document.createTextNode(' '));
			output.appendChild(button);

		} catch (e) {
			output.textContent = '';
			const message = ((e as Error | ErrorEvent).message) || '';
			const errEl = document.createElement('span');
			errEl.classList.add('error');
			errEl.textContent = '\u274C ' + message;
			output.appendChild(errEl);
		}
	});
}

{
	for (const el of Array.from(document.querySelectorAll('input, textarea'))) {
		el.addEventListener('focus', () => {
			for (const errEl of Array.from(document.querySelectorAll('#output-section output .error'))) {
				errEl.classList.add('obsolete');
			}
		})
	}
}