
const fs = require('fs');

function findEverything(filePath) {
    console.log(`Deep searching ${filePath}...`);
    const buffer = fs.readFileSync(filePath);

    // Search for "shifts":{
    const pattern = Buffer.from('"shifts":{');
    const patternUtf16 = Buffer.from('"shifts":{', 'utf16le');

    let index = buffer.indexOf(pattern);
    if (index === -1) index = buffer.indexOf(patternUtf16);

    if (index !== -1) {
        console.log("FOUND Pattern at", index);
        console.log(buffer.slice(index, index + 2000).toString('utf8'));
        console.log("---");
        console.log(buffer.slice(index, index + 2000).toString('utf16le'));
    } else {
        console.log("Pattern 'shifts' NOT found.");
    }
}

findEverything('backups/full_database_backup_.sql');
findEverything('backups/full_db_backup_20260112.sql');
