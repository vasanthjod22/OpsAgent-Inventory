const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function walkSync(currentDirPath, callback) {
    fs.readdirSync(currentDirPath).forEach(function (name) {
        const filePath = path.join(currentDirPath, name);
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
            callback(filePath, stat);
        } else if (stat.isDirectory()) {
            walkSync(filePath, callback);
        }
    });
}

const targetProps = `isAnimationActive={true} animationDuration={1500} animationEasing="ease-out"`;

walkSync(srcDir, (filePath) => {
    if (filePath.endsWith('.jsx')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;

        // Replace {...ANIMATION_DEFAULTS}
        if (content.includes('{...ANIMATION_DEFAULTS}')) {
            content = content.replace(/\{\.\.\.ANIMATION_DEFAULTS\}/g, targetProps);
            modified = true;
        }

        // Remove the import statement
        if (content.includes('ANIMATION_DEFAULTS')) {
            content = content.replace(/import\s*\{\s*ANIMATION_DEFAULTS\s*\}\s*from\s*['"].*?chartTheme['"];?\n?/, '');
            // Also replace in comma separated imports
            content = content.replace(/,\s*ANIMATION_DEFAULTS/g, '');
            content = content.replace(/ANIMATION_DEFAULTS\s*,/g, '');
            modified = true;
        }

        if (modified) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log('Fixed', filePath);
        }
    }
});
