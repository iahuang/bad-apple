/*
    A simple Javascript program that converts Bad Apple into a Javascript program that plays Bad Apple in the console.

    Requires: ffmpeg (binary), glob (node), pngjs (node)
*/

const CONFIG = {
    video_height: "detect", // playback height (in characters). if set to "detect", then use the height of the terminal that this program is currently running in
    fps: 24,
    output_file: "ba.js",
};

const os = require("os");
const fs = require("fs");
const path = require("path");
const child_process = require("child_process");
const stream = require("stream");
const PNG = require("pngjs").PNG;
const glob = require("glob");

const VIDEO = "res/video.mp4"; // input

// preliminary checks + utility functions

if (!["Linux", "Darwin"].includes(os.type())) {
    throw new Error("file must be run in a unix-based shell");
}

function _execSync(cmd) {
    return child_process.execSync(cmd, { encoding: "utf8" }).trim();
}

function _execSyncSilent(cmd) {
    child_process.execSync(cmd, { stdio: "ignore" });
}

function getTermInfo() {
    return {
        cols: Number.parseInt(_execSync("tput cols")),
        rows: Number.parseInt(_execSync("tput lines")),
    };
}

function mkdirIfNeeded(path) {
    if (!fs.existsSync(path)) {
        fs.mkdirSync(path);
    }
}

function hasFfmpeg() {
    return Boolean(_execSync("which ffmpeg"));
}

if (!hasFfmpeg()) {
    throw new Error("ffmpeg must be installed");
}

mkdirIfNeeded("tmp");

// calculate video dimensions

function getVideoDims(path) {
    let [w, h] = _execSync(
        `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 ${path}`
    ).split("x");
    return {
        width: Number.parseInt(w),
        height: Number.parseInt(h),
    };
}

let termDims = getTermInfo();

if (termDims.cols < termDims.rows) {
    // just to make things easier for me
    throw new Error("terminal cannot be taller than it is wide");
}

if (CONFIG.video_height !== "detect") {
    termDims = CONFIG.video_height;
}

let idims = getVideoDims(VIDEO);
let scale = termDims.rows / idims.height;

let newDims = {
    width: Math.round(idims.width * scale),
    height: termDims.rows,
};

// ffmpeg requires that width and height be divisble by 2
newDims.width -= newDims.width % 2;
newDims.height -= newDims.height % 2;

const SCALED_VIDEO = "tmp/_video.mp4";

let a = _execSync(
    `ffmpeg -y -i ${VIDEO} -vf scale=${newDims.width}:${newDims.height} ${SCALED_VIDEO}`
);

function extractFrames(path, fps) {
    _execSync(`ffmpeg -i ${path} -vf fps=${fps} tmp/out%d.png`);
}

extractFrames(SCALED_VIDEO, CONFIG.fps);
console.log("done.");

// scan for frame files and order them

let frameFiles = glob.sync("tmp/out*");
// sort frame files by frame number
frameFiles.sort((a, b) => {
    let frameNo = /\d+/g;
    let frameA = Number.parseInt(a.match(frameNo));
    let frameB = Number.parseInt(b.match(frameNo));

    return frameA - frameB;
});
console.log(frameFiles);
let frames = [];
let rawFrameData = [];

for (let frameFile of frameFiles) {
    console.log("processing frame", frameFile);
    let imgData = PNG.sync.read(fs.readFileSync(frameFile));
    let frame = "";
    let pixelDataArray = new Uint8Array(imgData.width * imgData.height);

    for (let y = 0; y < imgData.height; y++) {
        let row = "";
        for (let x = 0; x < imgData.width; x++) {
            let idx = (imgData.width * y + x) << 2;
            let v = imgData.data[idx];
            let fdi = imgData.width * y + x;

            if (v < 64) {
                pixelDataArray[fdi] = 65; // A
            } else if (v < 128) {
                pixelDataArray[fdi] = 66; // B
            } else if (v < 192) {
                pixelDataArray[fdi] = 67; // C
            } else {
                pixelDataArray[fdi] = 68; // D
            }


        }
        frame += row + "\n";
    }
    frames.push(frame);
    rawFrameData.push(new TextDecoder("utf8").decode(pixelDataArray));
}

fs.writeFileSync(
    CONFIG.output_file,
    `
const videoData=${JSON.stringify({
        width: newDims.width,
        height: newDims.height,
        data: rawFrameData,
        fps: CONFIG.fps,
    })};

console.log("Preparing...");

let frames = [];

const pixelColors = {
    "A": "  ",
    "B": "░░",
    "C": "▒▒",
    "D": "▒▒"
}

for (let frameData of videoData.data) {
    let frame = "";
    for (let y=0; y<videoData.height; y++) {
        let row = "";
        for (let x=0; x<videoData.width; x++) {
            let pixelCode = frameData[videoData.width * y + x];

            row+=pixelColors[pixelCode];
        }
        frame+=row+"\\n";
    }
    frames.push(frame.trim());
}

let frameNo = 0;

function render() {
    if (frameNo === videoData.data.length) {
        process.exit();
    }
    console.clear();
    console.log(frames[frameNo]);
    frameNo++;
}
setInterval(render, 1000/videoData.fps);

`
);
