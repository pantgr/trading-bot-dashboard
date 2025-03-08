const fs = require('fs');
const path = require('path');

const serverFilePath = path.join(__dirname, 'server.js');

// Read the contents of server.js
fs.readFile(serverFilePath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading server.js:', err);
    return;
  }

  // Add the import for config routes if it doesn't exist
  if (!data.includes('const configRoutes = require(')) {
    const importLine = 'const configRoutes = require(\'./routes/configRoutes\');\n';
    
    // Find a good place to add the import, after other route imports
    let newData = data;
    
    // Look for other route imports
    const routeImportPattern = /const \w+Routes = require\('\.\/routes\/\w+'\);/g;
    const matches = data.match(routeImportPattern);
    
    if (matches && matches.length > 0) {
      // Add after the last route import
      const lastMatch = matches[matches.length - 1];
      newData = data.replace(lastMatch, `${lastMatch}\n${importLine}`);
    } else {
      // Add near the top of the file
      newData = data.replace(/const express = require\('express'\);/, 
        `const express = require('express');\n${importLine}`);
    }
    
    data = newData;
  }
  
  // Add the route middleware if it doesn't exist
  if (!data.includes('app.use(\'/api/config\'')) {
    const routeLine = 'app.use(\'/api/config\', configRoutes);\n';
    
    // Find a good place to add the route, after other routes
    let newData = data;
    
    // Look for other app.use routes
    const routePattern = /app\.use\('\/api\/[\w-]+',\s*\w+Routes\);/g;
    const matches = data.match(routePattern);
    
    if (matches && matches.length > 0) {
      // Add after the last route
      const lastMatch = matches[matches.length - 1];
      newData = data.replace(lastMatch, `${lastMatch}\n${routeLine}`);
    } else {
      // Add before the server.listen
      newData = data.replace(/const PORT = .*/, 
        `${routeLine}\nconst PORT = `);
    }
    
    data = newData;
  }
  
  // Write the updated content back to server.js
  fs.writeFile(serverFilePath, data, 'utf8', (err) => {
    if (err) {
      console.error('Error writing to server.js:', err);
      return;
    }
    console.log('Successfully updated server.js');
  });
});
