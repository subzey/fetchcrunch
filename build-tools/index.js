import { readFile, writeFile, chmod } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'node:path';

const pathFromProjectRoot = resolve.bind(null, fileURLToPath(new URL('../', import.meta.url)));
const pathFromDist = resolve.bind(null, fileURLToPath(new URL('../package', import.meta.url)));

let pkgMetaPromise = (async function processPackageJson() {
	const pkgMeta = JSON.parse(
		await readFile(pathFromProjectRoot('package.json'), { encoding: 'utf-8'})
	);
	delete pkgMeta.private;
	delete pkgMeta.devDependencies;
	delete pkgMeta.scripts;
	return pkgMeta
})();

(async function copyPackageJson() {
	await writeFile(pathFromDist('package.json'), JSON.stringify(await pkgMetaPromise, null, 2));
})();

(async function copyReadme() {
	const readme = await readFile(
		pathFromProjectRoot('README.md'),
		{ encoding: 'utf-8' }
	);
	await writeFile(pathFromDist('README.md'), readme);
})();

(async function copyWasm() {
	const wasmBinary = await readFile(
		pathFromProjectRoot('artifacts/zopfli-with-dictionary.wasm')
	);
	await writeFile(
		pathFromDist('zopfli-with-dictionary.wasm'),
		wasmBinary
	);
})();

(async function makeExecutable() {
	const pkgMeta = await pkgMetaPromise;
	const toBeExecutable = pathFromProjectRoot('dist', pkgMeta.bin);
	await chmod(toBeExecutable, 0o775);
})();
