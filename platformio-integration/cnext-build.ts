#!/usr/bin/env node

/**
 * PlatformIO pre-build script for c-next transpilation
 * Place this file in your PlatformIO project root directory
 * Make sure to run: npm install --save-dev typescript @types/node
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const execAsync = promisify(exec);

interface TranspilationResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  error?: Error;
}

class CNextBuilder {
  private readonly projectDir: string;
  private readonly sourceDir: string;
  private readonly outputDir: string;

  constructor() {
    this.projectDir = process.env.PLATFORMIO_PROJECT_DIR || process.cwd();
    this.sourceDir = path.join(this.projectDir, 'src');
    this.outputDir = path.join(this.projectDir, 'generated');
  }

  /**
   * Find all c-next files in the project
   */
  private async findCNextFiles(): Promise<string[]> {
    const patterns = ['**/*.cn', '**/*.cnm'];
    const files: string[] = [];
    
    for (const pattern of patterns) {
      const matches = await glob(pattern, { cwd: this.sourceDir });
      files.push(...matches.map(match => path.join(this.sourceDir, match)));
    }
    
    return files;
  }

  /**
   * Ensure the output directory exists
   */
  private async ensureOutputDir(): Promise<void> {
    try {
      await fs.promises.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create output directory: ${error}`);
    }
  }

  /**
   * Run c-next transpiler using npx
   */
  private async transpile(): Promise<TranspilationResult> {
    const command = `npx c-next "${this.sourceDir}" "${this.outputDir}"`;
    
    try {
      console.log(`🔄 Running: ${command}`);
      const { stdout, stderr } = await execAsync(command, { 
        cwd: this.projectDir,
        timeout: 30000 // 30 second timeout
      });
      
      return {
        success: true,
        stdout,
        stderr
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  /**
   * Verify generated C files exist
   */
  private async verifyOutput(): Promise<string[]> {
    const cFiles = await glob('*.c', { cwd: this.outputDir });
    const hFiles = await glob('*.h', { cwd: this.outputDir });
    
    return [...cFiles, ...hFiles].map(file => path.join(this.outputDir, file));
  }

  /**
   * Main build process
   */
  public async build(): Promise<void> {
    console.log('🚀 Starting c-next transpilation...');
    
    try {
      // Find source files
      const cNextFiles = await this.findCNextFiles();
      
      if (cNextFiles.length === 0) {
        console.log('ℹ️  No c-next files found, skipping transpilation');
        return;
      }
      
      console.log(`📁 Found ${cNextFiles.length} c-next files:`);
      cNextFiles.forEach(file => {
        console.log(`   - ${path.relative(this.projectDir, file)}`);
      });
      
      // Ensure output directory exists
      await this.ensureOutputDir();
      
      // Run transpilation
      const result = await this.transpile();
      
      if (!result.success) {
        console.error('❌ c-next transpilation failed:');
        if (result.error) {
          if (result.error.message.includes('npx: command not found') || 
              result.error.message.includes('c-next: command not found')) {
            console.error('💡 c-next not found. Please install it:');
            console.error('   npm install -g c-next');
            console.error('   or ensure c-next is available in your PATH');
          } else {
            console.error(result.error.message);
          }
        }
        process.exit(1);
      }
      
      // Show output
      if (result.stdout) {
        console.log(result.stdout);
      }
      if (result.stderr && result.stderr.trim()) {
        console.warn('⚠️  Warnings:', result.stderr);
      }
      
      // Verify output files
      const generatedFiles = await this.verifyOutput();
      
      if (generatedFiles.length === 0) {
        console.error('❌ No C files were generated');
        process.exit(1);
      }
      
      console.log('✅ c-next transpilation completed successfully');
      console.log(`📦 Generated ${generatedFiles.length} C files:`);
      generatedFiles.forEach(file => {
        console.log(`   - ${path.relative(this.projectDir, file)}`);
      });
      
    } catch (error) {
      console.error('❌ Transpilation failed:', error);
      process.exit(1);
    }
  }
}

// Run the builder
const builder = new CNextBuilder();
builder.build().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});