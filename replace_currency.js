const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.html')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('frontend');
let count = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('$')) {
    content = content.replace(/\$([0-9])/g, 'Rs. $1');
    content = content.replace(/>\$</g, '>Rs.<');
    fs.writeFileSync(file, content, 'utf8');
    count++;
  }
});

console.log(`Replaced $ with Rs. in ${count} HTML files.`);
