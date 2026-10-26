# FrameForge — The Quality Method

FrameForge is part of my **Quality Method**, a setup designed to help you get the best possible look out of your gaming clips.

Instead of guessing which settings to use, this guide brings together the tools and settings I use for my videos, from how the game looks while recording to how the final video is exported and prepared for uploading.

## What's included?

### 🌐 FrameForge — Prepare Your Videos

FrameForge is a free, browser-based tool that prepares supported MP4 videos for playback and uploading.

Some MP4 files store important video information at the very end of the file. FrameForge can move this information to the beginning, allowing compatible players to start playing the video sooner.

- Works directly in your browser.
- Your video stays on your device; it isn't uploaded to a FrameForge server.
- Downloads a processed MP4 that you can use in your usual editing or uploading workflow.

**Important:** FrameForge does not make the actual video sharper or increase its resolution. It changes how the MP4 file is organised, and any improvement to TikTok upload quality is unverified.

### 🎨 NVIDIA Filters — Make Your Gameplay Look Better

NVIDIA Filters let you change the appearance of supported games.

Depending on the game and available filters, you can adjust things like:

- **Sharpness:** Make details look clearer.
- **Vibrance and colour:** Make colours stand out more.
- **Brightness and contrast:** Adjust how light, dark, and defined the image looks.
<img width="1439" height="899" alt="Screenshot 2026-10-26 032221" src="https://github.com/user-attachments/assets/ae1eaf67-616a-413d-adb5-0ca3a2557e90" />

I've included my recommended filter settings so you can try them yourself. You may need to adjust them slightly to suit your game and personal preference.

### 🎮 In-Game Graphics — Get Your Game Looking Right

Your graphics settings affect how your game looks while you're playing and recording.

This section includes my in-game settings, which aim to balance visual quality with smooth performance. Getting these right before recording can help you capture footage that looks the way you want from the start.
<img width="919" height="560" alt="image" src="https://github.com/user-attachments/assets/e97f1b41-3de3-4e4c-85f9-b34c7382885c" />

### ✂️ CapCut — Export Your Clips Properly

Exporting your video with suitable settings is important because the wrong settings can reduce quality before you even upload it.

I've included a screenshot of my CapCut settings so you can copy them when exporting your clips. These settings cover the options used to produce the final video, such as resolution, frame rate, and bitrate where available.

Your ideal settings may vary depending on your original recording and the platform you're uploading to.

## How to Use the Quality Method

1. **Set up your game** using the recommended graphics settings.
2. **Apply NVIDIA Filters** to get the look you want, if your game supports them.
3. **Record your clips** at your intended resolution and frame rate.
4. **Edit in CapCut** and use the recommended export settings.
5. **Use FrameForge** on your exported MP4 if it's supported.
6. **Watch the finished video** to check that it plays correctly before uploading.

Each part has a different job. NVIDIA Filters and graphics settings affect how the gameplay looks, CapCut handles editing and exporting, and FrameForge changes the organisation of the MP4 file.

## Does This Guarantee Better TikTok Quality?

No tool or setting can guarantee that TikTok will keep your video looking exactly the same after uploading. TikTok may compress, resize, or re-encode videos, which can affect their appearance.

The Quality Method is intended to give you a consistent setup and help avoid unnecessary quality loss along the way. Results will depend on your recording, export settings, and TikTok's processing.

---

# For Developers — Running FrameForge

The following section is for anyone who wants to run or deploy the FrameForge website itself.

## Requirements

- Node.js 20 or newer
- npm
- A modern browser with `ArrayBuffer`, `Blob`, and File API support

## Run Locally

Download or clone the project, open a terminal in the main project folder, and run:

```bash
npm install
npm run dev
```

Open the local URL shown in the terminal.

## Build the Website

```bash
npm run build
npm run preview
```

The production website is static and can be deployed to Vercel.

## Deploy to Vercel

1. Create a Git repository and add these project files.
2. Push the repository to GitHub/GitLab/Bitbucket.
3. In Vercel, choose **Add New → Project** and import the repository.
4. Set the framework preset to **Vite**, the build command to `npm run build`, and the output directory to `dist`.
5. Deploy. `vercel.json` rewrites app routes to the SPA entry point.

You can also use the Vercel CLI from the project folder:

```bash
npm install
npm run build
npx vercel
```

## How FrameForge Works

FrameForge reads MP4/M4V files directly in the browser. It does not upload videos to a server or use server-side processing.

It checks the structure of the MP4 file, including where its video information and media data are stored.

- If the file is already arranged for fast-start playback, FrameForge validates it and provides a new downloadable Blob containing the original bytes.
- If a supported, non-fragmented file stores its `moov` metadata after its `mdat` media data, FrameForge moves `moov` immediately after `ftyp` and updates the `stco` / `co64` chunk offsets.
- It then checks the resulting file's structure to verify the new ordering.
- The encoded audio and video data are copied unchanged. FrameForge does not decode, compress, or re-encode the media.
- The app includes a responsive interface, file inspection, error messages, downloads, and guide/FAQ sections.

## Current Limitations

FrameForge is an early version and cannot process every type of MP4 file.

It expects one `ftyp`, one `moov`, and one `mdat` box, and rejects fragmented MP4 files containing `moof`. Very large files may use too much browser memory. Unusual file layouts, external data references, encrypted media, edit lists, and vendor-specific boxes have not been exhaustively tested.

A successful structural check does not guarantee that every media player or social platform will accept the file.

## Recommended Testing Before Release

Test videos created by different recording and editing programs, and check playback in more than one player. Add automated tests for version-0/version-1 `mvhd`, `stco` and `co64`, files with boxes between `ftyp` and `mdat`, and malformed inputs.

For better support of large files, move parsing and patching into a Web Worker and implement streaming or bounded-memory processing.
