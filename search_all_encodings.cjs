
const fs = require('fs');

function search(path) {
    console.log(`Searching in ${path}...`);
    const encodings = ['utf8', 'utf16le', 'latin1'];
    for (let enc of encodings) {
        try {
            const content = fs.readFileSync(path, enc);
            if (content.includes('romero')) {
                console.log(`  Found 'romero' with ${enc}`);
                const idx = content.indexOf('romero');
                console.log("  Context:", content.substring(idx - 100, idx + 200));
            }
        } catch (e) { }
    }
}

search('backups/full_database_backup_.sql');
search('backups/full_db_backup_20260112.sql');
