import { spawn } from 'child_process';

export async function findFilesWithFd(workspaceRoot: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const files: string[] = [];
    
    const fdProcess = spawn('fd', [
      '--type', 'f',
      '--hidden',
      '--exclude', '.git',
      '--exclude', 'node_modules',
      '--exclude', 'dist',
      '--exclude', 'out',
      '--exclude', 'build',
      '.',
      workspaceRoot
    ]);

    let stdout = '';
    let stderr = '';

    fdProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    fdProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    fdProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`fd exited with code ${code}: ${stderr}`));
        return;
      }

      const lines = stdout.trim().split('\n').filter(line => line.length > 0);
      
      for (const line of lines) {
        const relativePath = line.replace(workspaceRoot, '').replace(/^\//, '');
        files.push(relativePath);
      }

      resolve(files);
    });

    fdProcess.on('error', (err) => {
      reject(new Error(`Failed to spawn fd: ${err.message}`));
    });
  });
}
