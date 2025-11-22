// build.js — small esbuild pipeline that bundles JS and writes a production index.html with inlined critical CSS
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

(async ()=>{
  const outdir = path.resolve(__dirname,'dist');
  if(!fs.existsSync(outdir)) fs.mkdirSync(outdir);

  // bundle script.js
  await esbuild.build({
    entryPoints: [path.resolve(__dirname,'script.js')],
    bundle: true,
    minify: true,
    sourcemap: false,
    outfile: path.join(outdir,'bundle.js'),
    platform: 'browser',
  });

  // read and minify styles.css (very lightweight minification)
  const css = fs.readFileSync(path.resolve(__dirname,'styles.css'),'utf8');
  const minCss = css.replace(/\/\*[^*]*\*+([^/*][^*]*\*+)*\//g,'').replace(/\n+/g,' ').replace(/\s{2,}/g,' ');

  // load index.html and replace links to scripts/styles with bundled outputs; inline critical CSS (minCss)
  const srcHtml = fs.readFileSync(path.resolve(__dirname,'index.html'),'utf8');
  // remove existing <link rel="stylesheet"> and <script type="module" src="script.js"></script>
  let outHtml = srcHtml.replace(/<link[^>]*href="styles.css"[^>]*>/i,'');
  outHtml = outHtml.replace(/<script[^>]*src="script.js"[^>]*>\s*<\/script>/i,'');

  // inject critical CSS into head
  outHtml = outHtml.replace('</head>', `\n<style>${minCss}</style>\n</head>`);

  // inject bundled script at end of body
  outHtml = outHtml.replace('</body>', `\n<script src="bundle.js" defer></script>\n</body>`);

  fs.writeFileSync(path.join(outdir,'index.html'), outHtml, 'utf8');
  // copy any other static assets if present (like data folder) - skip for now
  console.log('Build complete: dist/index.html and dist/bundle.js');
})();
