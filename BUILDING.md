## 📦 Package

The main package with base and node.js specific classes and code.js cli.

### Prerequisites

- Use Node.js and, 16.x or newer

- Install node modules: `npm install`

### Command

```sh
npm run build
```

### Output

The output directory is `./package`, gitignored.


## 📏 Tests

```sh
npm test
```


## 🔢 Zopfli WASM

_This step is optional. The `./artifacts` directory should already contain the compiled wasm._

Zopfli `ZopfliDeflatePart` function compiled into a WebAssembly binary.

### Prerequisites

- [Emscripten SDK](https://github.com/emscripten-core/emsdk)

- The `./zopfli` git submodule pulled: `cd zopfli; git pull`

### Command

```sh
npm run build-wasm
```

### Output

The output directory is `./artifacts`.

This directory is under git version control.


## 📄 GitHub Pages

_This step is optional if you're okay with the node cli._

Web base generator to be published on GitHub pages.

### Prerequisites

- Build the package first.

- Install node modules in `./src/gh-pages`:

```sh
cd src/gh-pages/
npm install
```

### Command

```
cd src/gh-pages/
npm run build
```

### Output

The output directory is `./gh-pages`/.

This directory is a git submodule that references the git repo itself, but using the `gh-pages` branch.
