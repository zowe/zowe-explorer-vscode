const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let targetDir;
try {
    const linkPath = path.join(__dirname, '../packages/zowe-explorer/node_modules/wdio-vscode-service');
    if (fs.existsSync(linkPath)) {
        targetDir = fs.realpathSync(linkPath);
    } else {
        targetDir = path.join(__dirname, '../node_modules/wdio-vscode-service');
    }
} catch (err) {
    targetDir = path.join(__dirname, '../node_modules/wdio-vscode-service');
}

console.log('Resolved target directory for wdio-vscode-service: ' + targetDir);
const targetDist = path.join(targetDir, 'dist');

// If dist already exists and has files, skip
if (fs.existsSync(targetDist) && fs.readdirSync(targetDist).length > 0) {
    console.log('wdio-vscode-service is already built. Skipping build step.');
    process.exit(0);
}

console.log('Building wdio-vscode-service from git...');

const tempDir = path.join(__dirname, '../temp-wdio-vscode-service');

try {
    // 1. Clean up old tempDir if exists
    if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }

    // 2. Clone the repository
    console.log('Cloning wdio-vscode-service (branch wdio-v9-migration)...');
    execSync('git clone --branch wdio-v9-migration --single-branch --depth 1 https://github.com/cidrblock/wdio-vscode-service.git "' + tempDir + '"', { stdio: 'inherit' });

    // 3. Install dependencies and build
    console.log('Installing dependencies and building in temporary directory (using npm to avoid monorepo/workspace interference)...');
    execSync('npm install', { cwd: tempDir, stdio: 'inherit' });

    execSync('npm run build', { cwd: tempDir, stdio: 'inherit' });

    // 4. Ensure target directory exists
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    // 5. Copy dist directory
    console.log('Copying compiled dist folder to: ' + targetDist);
    if (fs.existsSync(targetDist)) {
        fs.rmSync(targetDist, { recursive: true, force: true });
    }
    fs.cpSync(path.join(tempDir, 'dist'), targetDist, { recursive: true });

    // 6. Copy src folder
    const targetSrc = path.join(targetDir, 'src');
    console.log('Copying src folder to: ' + targetSrc);
    if (fs.existsSync(targetSrc)) {
        fs.rmSync(targetSrc, { recursive: true, force: true });
    }
    fs.cpSync(path.join(tempDir, 'src'), targetSrc, { recursive: true });

    console.log('Successfully built and updated wdio-vscode-service!');
} catch (error) {
    console.error('Failed to build wdio-vscode-service:', error);
    process.exit(1);
} finally {
    // 7. Clean up tempDir
    if (fs.existsSync(tempDir)) {
        console.log('Cleaning up temporary directories...');
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (cleanupError) {
            console.warn('Temporary directory cleanup failed:', cleanupError.message);
        }
    }
}
