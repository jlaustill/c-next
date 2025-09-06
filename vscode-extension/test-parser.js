const fs = require('fs');
const path = require('path');

// Import the compiled parser and symbol table
const { CNextParser } = require('./server/out/parser/CNextParser');
const { SymbolTable } = require('./server/out/semantic/SymbolTable');

async function testParser() {
  console.log('=== Testing CNextParser directly ===\n');
  
  // Create parser and symbol table
  const parser = new CNextParser();
  const symbolTable = new SymbolTable();
  
  // Test files
  const blinkFile = path.join(__dirname, 'examples/blink/src/Blink.cn');
  const mainFile = path.join(__dirname, 'examples/blink/src/main.cnm');
  
  console.log('1. Testing Blink.cn parsing:');
  console.log('============================');
  
  // Read and parse Blink.cn
  const blinkContent = fs.readFileSync(blinkFile, 'utf-8');
  const blinkDocument = {
    uri: `file://${blinkFile}`,
    getText: () => blinkContent,
    lineCount: blinkContent.split('\n').length
  };
  
  console.log('File content:');
  console.log(blinkContent);
  console.log('\nParsing results:');
  
  const blinkSymbols = await parser.parseDocument(blinkDocument, symbolTable);
  
  console.log(`\nFound ${blinkSymbols.length} symbols:`);
  blinkSymbols.forEach(symbol => {
    console.log(`  - ${symbol.kind}: ${symbol.name}${symbol.type ? ` (${symbol.type})` : ''}${symbol.containerName ? ` in ${symbol.containerName}` : ''}`);
  });
  
  // Check what's in the symbol table
  console.log('\n2. Symbol table state after Blink.cn:');
  console.log('====================================');
  
  const allSymbols = symbolTable.getAllSymbols();
  console.log(`Total symbols in table: ${allSymbols.length}`);
  
  const allTypes = symbolTable.getAllTypes();
  console.log('Available types:', allTypes);
  
  // Check if Blink class methods are available
  const blinkMethods = symbolTable.findObjectMethod('testObject', 'setup'); // This will trigger the debug logs
  
  console.log('\n3. Testing main.cnm parsing:');
  console.log('============================');
  
  // Read and parse main.cnm
  const mainContent = fs.readFileSync(mainFile, 'utf-8');
  const mainDocument = {
    uri: `file://${mainFile}`,
    getText: () => mainContent,
    lineCount: mainContent.split('\n').length
  };
  
  console.log('File content:');
  console.log(mainContent);
  console.log('\nParsing results:');
  
  const mainSymbols = await parser.parseDocument(mainDocument, symbolTable);
  
  console.log(`\nFound ${mainSymbols.length} symbols:`);
  mainSymbols.forEach(symbol => {
    console.log(`  - ${symbol.kind}: ${symbol.name}${symbol.type ? ` (${symbol.type})` : ''}${symbol.containerName ? ` in ${symbol.containerName}` : ''}`);
  });
  
  console.log('\n4. Testing method resolution:');
  console.log('=============================');
  
  // Test method resolution
  const setupMethod = symbolTable.findObjectMethod('blinker', 'setup');
  console.log(`blinker.setup() resolution: ${setupMethod ? 'FOUND' : 'NOT FOUND'}`);
  
  const loopMethod = symbolTable.findObjectMethod('blinker', 'loop'); 
  console.log(`blinker.loop() resolution: ${loopMethod ? 'FOUND' : 'NOT FOUND'}`);
}

// Run the test
testParser().catch(console.error);