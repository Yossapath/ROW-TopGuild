const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else if (file.endsWith('route.ts')) { 
      results.push(file);
    }
  });
  return results;
}

walk('app/api').forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (file.includes('queues/route.ts') || file.includes('queues\\route.ts')) {
     content = content.replace('import { ok, err, isBookingOpen } from "@/lib/utils";', 'import { ok, err } from "@/lib/server-utils";\nimport { isBookingOpen } from "@/lib/utils";');
  } else {
     content = content.replace(/import \{ (.*ok.*) \} from "@\/lib\/utils";/, 'import { $1 } from "@/lib/server-utils";');
  }
  fs.writeFileSync(file, content);
});
console.log("Done");
