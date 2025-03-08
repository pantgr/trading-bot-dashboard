const fs = require('fs');

// Read the server.js file
fs.readFile('server.js', 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading server.js:', err);
    return;
  }

  // Fix the PORT definition and config routes placement
  const fixedContent = data.replace(
    // Start server
    // app.use('/api/config', configRoutes);
    // 
    // const PORT =
    // server.listen(PORT, () => {
    /app\.use\('\/api\/config', configRoutes\);(\s*\n\s*)const PORT =(\s*\n\s*)server\.listen/,
    
    // Move configRoutes before PORT definition and add PORT value
    `// Add routes
app.use('/api/config', configRoutes);

// Start server
const PORT = process.env.PORT || 5000;
server.listen`
  );

  // Write the fixed content back to server.js
  fs.writeFile('server.js', fixedContent, 'utf8', (err) => {
    if (err) {
      console.error('Error writing to server.js:', err);
      return;
    }
    console.log('Successfully fixed server.js');
  });
});
