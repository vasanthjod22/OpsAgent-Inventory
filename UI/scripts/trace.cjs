const fs = require('fs');
const sourceMap = require('source-map');

async function trace() {
  const codePath = 'dist/assets/index-DbVb7YTu.js';
  const mapPath = 'dist/assets/index-DbVb7YTu.js.map';
  
  if (!fs.existsSync(codePath)) {
    console.log('Code not found:', codePath);
    return;
  }
  
  const code = fs.readFileSync(codePath, 'utf8');
  const rawMap = fs.readFileSync(mapPath, 'utf8');
  const consumer = await new sourceMap.SourceMapConsumer(rawMap);
  
  const lines = code.split('\n');
  const matches = [];
  
  // Find all occurrences of the variable "me"
  const regex = /\bme\b/g;
  
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    let match;
    while ((match = regex.exec(line)) !== null) {
      const col = match.index;
      
      const pos = consumer.originalPositionFor({
        line: lineNum + 1,
        column: col
      });
      
      if (pos.source && !pos.source.includes('node_modules')) {
        matches.push({
          line: lineNum + 1,
          col,
          source: pos.source,
          originalLine: pos.line,
          originalCol: pos.column,
          name: pos.name
        });
      }
    }
  }
  
  consumer.destroy();
  
  console.log(`Found ${matches.length} occurrences of 'me' in our src code:`);
  matches.forEach(m => {
    console.log(`At ${m.line}:${m.col} -> ${m.source}:${m.originalLine} (original name: ${m.name})`);
  });
}

trace().catch(console.error);
