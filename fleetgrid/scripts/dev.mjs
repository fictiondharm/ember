/**
 * One-command dev runner: starts the API (4000) and the web app (5173) together.
 * Output is prefixed per process and Ctrl+C stops both.
 */
import { spawn } from 'node:child_process';
import process from 'node:process';

const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const targets = [
  { name: 'api', color: '[36m', args: ['--prefix', 'server', 'run', 'dev'] },
  { name: 'web', color: '[35m', args: ['--prefix', 'web', 'run', 'dev'] },
];

const RESET = '[0m';
const children = [];
let shuttingDown = false;

for (const target of targets) {
  // Windows refuses to spawn npm.cmd directly without a shell (CVE-2024-27980 mitigation).
  const child = spawn(NPM, target.args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });
  children.push(child);

  const prefix = `${target.color}[${target.name}]${RESET} `;
  const pipe = (stream) => {
    let buffer = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) process.stdout.write(prefix + line + '\n');
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);

  child.on('exit', (code) => {
    if (shuttingDown) return;
    process.stdout.write(`${prefix}exited with code ${code}\n`);
    shutdown(code ?? 1);
  });
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null) child.kill();
  }
  process.exitCode = code;
  setTimeout(() => process.exit(code), 300);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

process.stdout.write('\nFleetGrid starting:\n  API          http://localhost:4000\n  Web          http://localhost:5173\n  Open the web URL on 3 devices and pick a mode on each.\n\n');
