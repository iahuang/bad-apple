# bad-apple.js

A Javascript implementation of the famous music video for the song featured in *Touhou*

## Usage

To compile a version of the playback script configured for your current terminal size, run
```
npm install
node build.js
```
Keep in mind that you will need to have a copy of `ffmpeg` installed on your computer beforehand. Additionally, the build script will only run on Unix-based shell environments such as `bash` on Mac, Linux, or WSL.

Alternatively, run the prebuilt script located at `dist/ba.js`, which has been configured for a 64x24 character terminal.