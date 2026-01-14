import { spawn } from 'child_process';

export async function findFilesWithRipgrep(workspaceRoot: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const files: string[] = [];
    
    const rgProcess = spawn('rg', [
      '--files',
      '--hidden',
      '--glob', '!.git/',
      '--glob', '!node_modules/',
      '--glob', '!dist/',
      '--glob', '!out/',
      '--glob', '!build/',
      workspaceRoot
    ]);

    let stdout = '';
    let stderr = '';

    rgProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    rgProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    rgProcess.on('close', (code) => {
      if (code !== 0 && code !== 1) {
        reject(new Error(`rg exited with code ${code}: ${stderr}`));
        return;
      }

      const lines = stdout.trim().split('\n').filter(line => line.length > 0);
      
      for (const line of lines) {
        const relativePath = line.replace(workspaceRoot, '').replace(/^\//, '');
        files.push(relativePath);
      }

      resolve(files);
    });

    rgProcess.on('error', (err) => {
      reject(new Error(`Failed to spawn rg: ${err.message}`));
    });
  });
}
