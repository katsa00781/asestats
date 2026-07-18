// Közös child-process futtató a scraping API route-okhoz.
// Korábban a spawn wrapper + NPX_COMMAND 4 route-ban volt duplikálva.
// FIGYELEM: csak hosszú életű Node processen működik (self-hosted / next start),
// serverless környezetben nem – lásd context/architecture.md.

import { spawn } from 'child_process';

export const NPX_COMMAND = process.platform === 'win32' ? 'npx.cmd' : 'npx';

export type ScriptResult = {
  stdout: string;
  stderr: string;
};

export type ScriptError = Error & {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
};

/** Egy gyökérszintű tsx szkript futtatása; stdout/stderr gyűjtéssel, abort támogatással. */
export const runScript = (scriptName: string, env: NodeJS.ProcessEnv, signal?: AbortSignal) =>
  new Promise<ScriptResult>((resolve, reject) => {
    let settled = false;

    const child = spawn(NPX_COMMAND, ['tsx', scriptName], {
      cwd: process.cwd(),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    const safeResolve = (value: ScriptResult) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const safeReject = (error: ScriptError) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const handleAbort = () => {
      child.kill('SIGTERM');
      safeReject(Object.assign(new Error(`Az import folyamat megszakadt (${scriptName}).`), { stdout, stderr, exitCode: 1 }));
    };

    if (signal) {
      if (signal.aborted) {
        handleAbort();
        return;
      }
      signal.addEventListener('abort', handleAbort, { once: true });
    }

    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    child.on('error', error => {
      safeReject(Object.assign(error, { stdout, stderr, exitCode: 1 }));
    });

    child.on('close', code => {
      if (signal) {
        signal.removeEventListener('abort', handleAbort);
      }

      if (code === 0) {
        safeResolve({ stdout, stderr });
      } else {
        safeReject(
          Object.assign(new Error(`Az importáló script (${scriptName}) ${code ?? 1} kóddal állt le.`), {
            stdout,
            stderr,
            exitCode: code ?? 1,
          })
        );
      }
    });
  });
