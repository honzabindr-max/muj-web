#!/usr/bin/env node
/**
 * Stáhne volně licencované fotky z Wikimedia Commons pro stránku /soci.
 * Licence: CC BY / CC BY-SA / CC0 / Public Domain pouze.
 * Výstup: public/soci/photos/*.jpg + public/soci/photos/index.json
 */
import { spawnSync } from 'child_process';
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PHOTOS_DIR = join(ROOT, 'public', 'soci', 'photos');
const INDEX_PATH = join(PHOTOS_DIR, 'index.json');

mkdirSync(PHOTOS_DIR, { recursive: true });

const UA = 'muj-web-soci/1.0 (https://good-inventions.work; honza.bindr@gmail.com)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Potvrzené soubory s volnými licencemi (ověřeno 29.6.2026)
const FILES = [
  {
    key: 'soca-reka',
    title: 'File:Soča, the emerald river (185851175).jpg',
    alt: 'Smaragdová řeka Soča v Julských Alpách',
    license: 'CC BY-SA 2.0',
    author: 'Lars Plougmann',
    width: 3264,
    height: 2448,
  },
  {
    key: 'velika-korita',
    title: 'File:Velika korita Soce (1).jpg',
    alt: 'Velika korita Soče — úzká soutěska na Soča Trailu',
    license: 'CC BY-SA 4.0',
    author: 'Krzysztof Golik',
    width: 2750,
    height: 3875,
  },
  {
    key: 'boka-vodopad',
    title: 'File:Boka Waterfall, Slovenia (15996635505).jpg',
    alt: 'Vodopád Boka — nejvodnatější vodopád Slovinska (~106 m)',
    license: 'CC BY 2.0',
    author: 'Leon Yaakov',
    width: 1944,
    height: 2592,
  },
  {
    key: 'virje-vodopad',
    title: 'File:Slap Virje.jpg',
    alt: 'Vodopád Virje u Bovce — laguna pod vodopádem',
    license: 'CC BY-SA 3.0',
    author: 'Tiia Monto',
    width: 5280,
    height: 3576,
  },
  {
    key: 'vrsic-pass',
    title: 'File:Julian Alps from Vrsic Pass (3).jpg',
    alt: 'Průsmyk Vršič (1611 m) — výhledy na Julské Alpy',
    license: 'CC BY-SA 4.0',
    author: 'Krzysztof Golik',
    width: 7037,
    height: 2317,
  },
  {
    key: 'pramen-soce',
    title: 'File:Izvir Soče (5958629406).jpg',
    alt: 'Pramen Soče (Izvir Soče) — horská tůň u ferráty',
    license: 'CC BY 2.0',
    author: 'Igor Pečovnik',
    width: 3072,
    height: 1728,
  },
  {
    key: 'ruska-kaple',
    title: 'File:Ruska Cesta - Ruska Kapelica - Ruska Kapela (41627950121).jpg',
    alt: 'Ruská kaple na Vršiči — dřevěná kaple z roku 1917',
    license: 'CC BY 2.0',
    author: 'Dage – Looking For Europe',
    width: 5184,
    height: 3888,
  },
  {
    key: 'bovec',
    title: 'File:Mountain panorama in Bovec.jpg',
    alt: 'Bovec v údolí Soče — základna výpravy',
    license: 'CC BY-SA 3.0',
    author: 'Tiia Monto',
    width: 1280,
    height: 427,
  },
  {
    key: 'kluzhe',
    title: 'File:Bovec Kluže Flitscher Klause West-Seite 10032015 0609.jpg',
    alt: 'Pevnost Kluže — austro-uherská pevnost v soutěsce Učja',
    license: 'CC BY-SA 4.0',
    author: 'Johann Jaritz',
    width: 7250,
    height: 4319,
  },
  {
    key: 'rafting-soca',
    title: 'File:Rafting river Soča 3.jpg',
    alt: 'Rafting na smaragdové Soče — WW II–III',
    license: 'CC BY-SA 3.0',
    author: 'malenki',
    width: 2848,
    height: 2136,
  },
];

async function getFileUrl(title) {
  const url =
    'https://commons.wikimedia.org/w/api.php?' +
    new URLSearchParams({
      action: 'query',
      prop: 'imageinfo',
      titles: title,
      iiprop: 'url',
      format: 'json',
    });
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  const d = await res.json();
  const page = Object.values(d.query?.pages || {})[0];
  return page?.imageinfo?.[0]?.url;
}

async function downloadBuffer(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function resizeJpeg(srcPath, destPath, maxWidth) {
  const result = spawnSync('sips', [
    '--resampleWidth', String(maxWidth),
    '-o', destPath,
    srcPath,
  ]);
  if (result.status !== 0) {
    throw new Error('sips error: ' + (result.stderr?.toString() || result.status));
  }
}

async function run() {
  const results = [];

  for (const f of FILES) {
    const destFile = `${f.key}.jpg`;
    const destPath = join(PHOTOS_DIR, destFile);

    console.log(`\n📷 ${f.key}`);

    // Přeskoč pokud soubor existuje
    if (existsSync(destPath)) {
      console.log(`  ⏭  Existuje, přeskakuji`);
      results.push({ ...f, file: destFile, commonsUrl: commonsUrl(f.title) });
      continue;
    }

    try {
      await sleep(600);
      console.log(`  → API: ${f.title.slice(0, 60)}`);
      const srcUrl = await getFileUrl(f.title);
      if (!srcUrl) throw new Error('Nelze získat URL z Commons API');
      console.log(`  → Stahuju (${f.width}×${f.height})...`);

      await sleep(200);
      const buf = await downloadBuffer(srcUrl);
      const tmpPath = join(PHOTOS_DIR, `_tmp_${f.key}.jpg`);
      writeFileSync(tmpPath, buf);
      console.log(`  → Staženo ${(buf.length / 1024).toFixed(0)} kB`);

      // Resize jen pokud je originál širší než 1600 px
      if (f.width > 1600) {
        resizeJpeg(tmpPath, destPath, 1600);
        console.log(`  → Resize → ${destFile}`);
      } else {
        // Přejmenuj bez resize (originál je menší)
        writeFileSync(destPath, buf);
        console.log(`  → Uloženo beze změny → ${destFile}`);
      }
      if (existsSync(tmpPath)) unlinkSync(tmpPath);

      results.push({ ...f, file: destFile, commonsUrl: commonsUrl(f.title) });
      console.log(`  ✓ OK — ${f.license} — ${f.author}`);
    } catch (err) {
      console.error(`  ❌ Chyba: ${err.message}`);
      if (existsSync(join(PHOTOS_DIR, `_tmp_${f.key}.jpg`))) {
        unlinkSync(join(PHOTOS_DIR, `_tmp_${f.key}.jpg`));
      }
    }
  }

  writeFileSync(INDEX_PATH, JSON.stringify(results, null, 2), 'utf-8');

  console.log(`\n✅ Hotovo! ${results.length}/${FILES.length} fotek.`);
  console.log('\nSeznam:');
  for (const r of results) {
    console.log(`  ${r.key}.jpg — ${r.license} — ${r.author}`);
  }
}

function commonsUrl(title) {
  return 'https://commons.wikimedia.org/wiki/' + encodeURIComponent(title.replace(/ /g, '_'));
}

run().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
