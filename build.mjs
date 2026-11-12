// Fabrique index.html (page autonome) à partir de app.html (le fragment publié comme artifact).
import { readFileSync, writeFileSync } from 'node:fs';
const body = readFileSync(new URL('./app.html', import.meta.url), 'utf8');
const head = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
  '<style>:root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}html{box-sizing:border-box}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style></head><body>\n';
writeFileSync(new URL('./index.html', import.meta.url), head + body + '</body></html>\n');
console.log('index.html généré');
