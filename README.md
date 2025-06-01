# Audio Recorder App

This is a React Native application built as part of a coding challenge. The app enables users to:

- Record audio
- Visualize audio waveform in real-time
- Manage and play back saved recordings
- Rename recordings after saving

---

## ✨ Features & Implementation

### 🎙️ Audio Recording
- Uses [`react-native-audio-record`](https://www.npmjs.com/package/react-native-audio-record) for real-time audio recording.
- Records audio in `.wav` format.
- Requests microphone permissions at runtime.

### 📊 Real-Time Waveform Visualization
- Captures live audio data from the recorder’s metering.
- Renders waveform using [`react-native-svg`](https://github.com/software-mansion/react-native-svg).
- Waveform updates as audio is being recorded.

### 🎧 Playback with Waveform and Playhead
- Uses standard `Audio` APIs or custom logic to play back recorded files.
- Visual playhead moves along the waveform during playback.

### 📁 File Management
- Saved recordings are listed from the app’s local storage.
- Users can rename recordings after saving.
- Uses [`react-native-fs`](https://github.com/itinance/react-native-fs) for file system operations.


### 🚀 Running the App
Install Dependencies
``` bash
npm install
``` 
Run on Android
``` bash
npx react-native run-android
``` 
Make sure you have an Android emulator running or a device connected with USB debugging enabled.

### 📦 APK File
The release APK is located at:
``` bash
Release.zip/app-release.apk
``` 
To build the release APK manually:
``` bash
cd android
.\gradlew.bat assembleRelease
```
### 📝 Notes
This app is Android-only; iOS support has not been tested.

Ensure microphone permissions are granted when prompted on first use.

If you encounter build warnings about deprecated APIs or manifest package attributes, updating dependencies and Gradle versions may help.




