const fs = require('fs');
const path = require('path');

function replaceColor(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'migrated_prompt_history') {
        replaceColor(fullPath);
      }
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts') || fullPath.endsWith('.html')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('#FAFAFA') || content.includes('bg-[#FAFAFA]')) {
        content = content.replace(/#FAFAFA/g, '#FDFBF7'); // FDFBF7 is a comfortable warm white for studying
        fs.writeFileSync(fullPath, content);
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

replaceColor(__dirname);
