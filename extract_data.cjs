
const fs = require('fs');
const path = 'backups/full_database_backup_.sql';

try {
    const content = fs.readFileSync(path, 'utf16le');
    const index = content.indexOf('employees');
    if (index !== -1) {
        console.log("Found 'employees' at index", index);
        console.log("Context:", content.substring(index - 500, index + 2000));
    } else {
        console.log("'employees' NOT found in the backup file.");
    }
} catch (e) {
    console.error(e.message);
}
