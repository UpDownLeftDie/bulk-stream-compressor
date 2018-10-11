const _ = require('lodash');
const fs = require('fs');
const spawnSync = require('child_process').spawnSync;
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

const FILE_FORMATS = [".mp4", ".flv", ".mkv"];v

const config = loadConfig();

function loadConfig() {
    let config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
    config.fileFormats = FILE_FORMATS;
    if (config.ignoreFileFormats && config.ignoreFileFormats.length) {
        config.ignoreFileFormats.forEach(ignoredFileFormat => {
            const index = config.fileFormats.indexOf(ignoredFileFormat.toLowerCase());
            if (index !== -1) {
                config.fileFormats.splice(index, 1);
            }
        });
    }
    return config;
}

main();

async function main() {
    const { inputFolder, fileFormats } = config;
    const files = await getAllFiles(inputFolder, fileFormats);
}

async function getAllFiles(dir, fileFormats) {
    let files = fs.readdirSync(dir);
    files = await files.reduce(async (previousPromise, file) => {
        let filterdFiles = await previousPromise;
        const index = fileFormats.indexOf(path.extname(file).toLowerCase());
        if (index !== -1) {
            const metadata = await readVideoFile(path.join(dir, file));
            filterdFiles[file] = metadata;
        }
        return filterdFiles;
    }, Promise.resolve({}));

    return files;
}

function readVideoFile(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, function(err, metadata) {
            if (err) reject(err);
            resolve(metadata);
        });
    });
}

// function cleanUp(){

//     deleteFile();
// }



// function deleteFile() {

// }

// function createFFmpegProcess() {

// }