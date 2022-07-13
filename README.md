# FetchCrunch

(née `deflated-js`)

Just like [ZPNG](https://xem.github.io/projects/zpng.html) and [JsExe](https://www.pouet.net/prod.php?which=59298) it wraps the JavaScript into a compressed format that is also an HTML page that somehow gets its own contents, decompresses, and `eval`uates it.

Unlike ZPNG / JsExe, FetchCrunch is using more modern browser API, [`CompressionStream`](https://developer.mozilla.org/en-US/docs/Web/API/Compression_Streams_API). In fact, this `CompressionStream` API is so modern, that...

`◤◢◤◢◤◢◤◢◤◢ WARNING ◤◢◤◢◤◢◤◢◤◢`

⚠ The generated HTML only works in Chromium based browsers fo far ⚠

`◤◢◤◢◤◢◤◢◤◢ WARNING ◤◢◤◢◤◢◤◢◤◢`

## Online

[Online generator](https://subzey.github.io/fetchcrunch/)

## Node CLI

```sh
npx fetchcrunch
```

## Node API

```js
import { FetchCrunchNode } from 'fetchcrunch';

/* ... */

await new FetchCrunchNode().crunch( someJavaScriptCode );
```

FetchCrunch is created to be configurable. Please import and extend `FetchCrunchNode` and `FetchCrunchBase` for your purposes.

## Legal stuff

FetchCrunch is using [zopfli](https://github.com/google/zopfli/) that is licensed under the Apache License 2.0
