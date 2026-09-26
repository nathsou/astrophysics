import { compile } from '@mdx-js/mdx';
import fs from 'fs';
const src = fs.readFileSync('src/pages/ch/energy-transport.mdx', 'utf8');
try {
  await compile(src, {});
  console.log('OK');
} catch (e) {
  console.log('ERR', e.message);
  console.log('place', JSON.stringify(e.place));
  console.log('line', e.line, 'column', e.column);
  console.log(e.stack);
  console.log('cause', e.cause);
}
