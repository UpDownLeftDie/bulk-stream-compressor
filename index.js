const _ = require('lodash');
const fs = require('fs');
const spawnSync = require('child_process').spawnSync;

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

main();

function main() {
    cleanUp();
}

function cleanUp(){
    
    deleteFile();
}

function getAllFiles() {

}

function deleteFile() {

}

function createFFmpegProcess() {

}