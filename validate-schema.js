const fs = require('fs');
const path = require('path');

// Simple JSON-LD extractor: finds <script type="application/ld+json"> blocks and parses JSON
function extractJsonLd(html){
  const blocks = [];
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const raw = match[1].trim();
    try { blocks.push(JSON.parse(raw)); } catch(e){
      throw new Error('Invalid JSON-LD block: ' + e.message);
    }
  }
  return blocks;
}

function flattenGraph(obj){
  if (Array.isArray(obj)) return obj.flatMap(flattenGraph);
  if (obj && typeof obj === 'object') {
    if (obj['@graph']) return flattenGraph(obj['@graph']);
    return [obj];
  }
  return [];
}

function validateBlocks(blocks, file){
  const graph = flattenGraph(blocks);
  if (!graph.length) throw new Error(`No JSON-LD entities found in ${file}`);
  const requiredTypes = new Set();
  // Basic validations
  graph.forEach(node=>{
    if (!node['@type']) throw new Error(`Entity missing @type in ${file}`);
    if (node['@type'] === 'SoftwareSourceCode') {
      ['name','description','url'].forEach(f=>{ if(!node[f]) throw new Error(`SoftwareSourceCode missing ${f} in ${file}`); });
    }
    if (node['@type'] === 'CreativeWork') {
      ['name','description','url'].forEach(f=>{ if(!node[f]) throw new Error(`CreativeWork missing ${f} in ${file}`); });
    }
    requiredTypes.add(node['@type']);
  });
  // Ensure we have at least one SoftwareSourceCode on project pages
  if (file.includes('projects') && !graph.some(n=>n['@type']==='SoftwareSourceCode')) {
    throw new Error(`Project page ${file} missing SoftwareSourceCode schema`);
  }
}

function main(){
  const root = __dirname;
  const targets = [ 'index.html', ...fs.readdirSync(path.join(root,'projects')).filter(f=>f.endsWith('.html')).map(f=>`projects/${f}`) ];
  let errors = 0;
  targets.forEach(file=>{
    try {
      const html = fs.readFileSync(path.join(root,file),'utf8');
      const blocks = extractJsonLd(html);
      validateBlocks(blocks, file);
      console.log(`OK: ${file}`);
    } catch(e){
      errors++; console.error(`FAIL: ${file} -> ${e.message}`);
    }
  });
  if (errors){
    console.error(`Validation failed with ${errors} error(s).`);
    process.exit(1);
  } else {
    console.log('All JSON-LD validations passed.');
  }
}

if (require.main === module) main();
