const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const ffprobe = require('fluent-ffmpeg');
const ffmpeg = 'bin\\ffmpeg.exe';
const spawnSync = require('child_process').spawnSync;

const FILE_FORMATS = [".mp4", ".flv", ".mkv"];

const config = loadConfig();

main();


function loadConfig() {
    let config = require('./config.json');
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

async function main() {
    const { fileFormats, inputFolder, minLengthSec } = config;
    let files = await getAllFiles(inputFolder, fileFormats);
    if (minLengthSec) {
        files = cleanUp(files, inputFolder, minLengthSec);
    }
    console.log('starting convert videos');
    const promises = convertVideos(files, config);
    await promises;
    console.log('finished convert videos');
}

async function getAllFiles(dir, fileFormats) {
    let files = fs.readdirSync(dir);
    files = await files.reduce(async (previousPromise, file) => {
        let filterdFiles = await previousPromise;
        const index = fileFormats.indexOf(path.extname(file).toLowerCase());
        if (index > -1) {
            const metadata = await readVideoFile(path.join(dir, file));
            filterdFiles[file] = metadata;
        }
        return filterdFiles;
    }, Promise.resolve({}));

    return files;
}

function readVideoFile(filePath) {
    return new Promise((resolve, reject) => {
        ffprobe.ffprobe(filePath, function(err, metadata) {
            if (err) reject(err);
            resolve(metadata);
        });
    });
}

function cleanUp(files, dir, minLengthSec = 0){
    let remainingFiles = {};
    _.forEach(files, (metadata, filename) => {
        const filePath = path.join(dir, filename);
        const duration = _.get(metadata, 'format.duration');
        if (duration < minLengthSec) {
            console.log(`**DELETING** ${filePath}`);
            deleteFile(filePath);
        } else {
            remainingFiles[filename] = metadata;
        }
    });
    return remainingFiles;
}

async function deleteFile(filePath) {
    return new Promise((resolve, reject) => {
        fs.unlink(filePath, (err) => {
            if (err) reject(err);
            console.log(`${filePath} was deleted`);
            resolve();
          });
    });
}

async function convertVideos(files, config) {
    const {
        inputFolder,
        outputFolder,
        targetBitrate
    } = config;

    const commands = await _.map(files, (metadata, filename) => {
        return new Promise((resolve, reject) => {
            const inputFilePath = path.join(inputFolder, filename);
            const outputFilePath = path.join(outputFolder, getOutputName(filename, 'mp4'));
            const pass1Args = [
                '-y',
                '-i',
                inputFilePath,
                '-c:v',
                'libx265',
                '-b:v',
                targetBitrate,
                '-x265-params',
                'pass=1',
                '-an',
                '-f',
                'mp4',
                'NUL'
            ];
            const pass2Args = [
                '-i',
                inputFilePath,
                '-c:v',
                'libx265',
                '-b:v',
                targetBitrate,
                '-x265-params',
                'pass=2',
                '-movflags',
                '+faststart',
                '-c:a',
                'aac',
                '-b:a',
                '160k',
                outputFilePath
            ];

            const ffmpegProcess1 = spawnSync(ffmpeg, pass1Args);
            let stderr = ffmpegProcess1.stderr.toString();
            let { status } = ffmpegProcess1;
            let stdout = ffmpegProcess1.stdout.toString();
            if (stderr) {
                console.log(`\nError during Pass 1: ${stderr}`);
                reject();
            }
            console.log(`\nPass 1 status: ${status}`);
            console.log(`\nPass 1stdout: ${stdout}`);

            const ffmpegProcess2 = spawnSync(ffmpeg, pass2Args);
            stderr = ffmpegProcess2.stderr.toString();
            status = ffmpegProcess2.status;
            stdout = ffmpegProcess2.stdout.toString();
            if (stderr) {
                console.log(`\nError during Pass 2: ${stderr}`);
                reject();
            }
            console.log(`\nPass 2 status: ${status}`);
            console.log(`\nPass 2 stdout: ${stdout}`);
            // TODO delete inputFilePath on success
            // deleteFile(inputFilePath);
            resolve();
        });
    });

    return Promise.all(commands);
};
    
function getOutputName(filename, newExt) {
    const fileExt = path.extname(filename);
    return `${filename.slice(0, -fileExt.length)}.${newExt}`;
}