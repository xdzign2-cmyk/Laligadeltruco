
const fs = require('fs');

function findShifts(filePath) {
    console.log(`Searching for shifts in ${filePath}...`);
    try {
        const content = fs.readFileSync(filePath, 'utf16le');
        const match = content.match(/\"shifts\":\s*({[^{}]*({[^{}]*}[^{}]*)*})/);
        if (match) {
            console.log("Found something!");
            console.log(match[0].substring(0, 500));
        } else {
            console.log("No shifts found.");
        }
    } catch (e) {
        console.error("Error reading file:", e.message);
    }
}

findShifts('backups/full_database_backup_.sql');
findShifts('backups/full_db_backup_20260112.sql');
