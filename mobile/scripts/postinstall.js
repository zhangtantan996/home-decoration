const fs = require('fs');
const path = require('path');

function removeDir(dirPath) {
  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
    return true;
  } catch (_err) {
    return false;
  }
}

const projectRoot = path.resolve(__dirname, '..');

const dirsToRemove = [
  path.join(projectRoot, 'node_modules', 'react-native-camera-kit', 'android', 'build'),
];

let removedCount = 0;
for (const dirPath of dirsToRemove) {
  if (fs.existsSync(dirPath) && removeDir(dirPath)) {
    removedCount += 1;
    process.stdout.write(`[postinstall] Removed ${path.relative(projectRoot, dirPath)}\n`);
  }
}

if (removedCount === 0) {
  process.stdout.write('[postinstall] Nothing to clean\n');
}
