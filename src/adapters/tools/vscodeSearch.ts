import * as vscode from 'vscode';
import * as path from 'path';

export async function findFilesWithVSCode(workspaceRoot: string): Promise<string[]> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.find(
    folder => folder.uri.fsPath === workspaceRoot
  );

  if (!workspaceFolder) {
    return [];
  }

  const files = await vscode.workspace.findFiles(
    new vscode.RelativePattern(workspaceFolder, '**/*'),
    '{**/node_modules/**,**/.git/**,**/dist/**,**/out/**,**/build/**}'
  );

  const relativePaths = files.map(uri => {
    const absolutePath = uri.fsPath;
    const relativePath = path.relative(workspaceRoot, absolutePath);
    return relativePath;
  });

  return relativePaths;
}
