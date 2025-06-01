import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  Button,
  StyleSheet,
  PermissionsAndroid,
  Platform,
  Dimensions,
  FlatList,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import AudioRecord from 'react-native-audio-record';
import { Svg, Path, Line } from 'react-native-svg';
import Sound from 'react-native-sound';
import RNFS from 'react-native-fs';

const SCREEN_WIDTH = Dimensions.get('window').width;
const WAVEFORM_HEIGHT = 100;
const MAX_POINTS = 100;

const AudioWaveformRecorder = () => {
  const [recording, setRecording] = useState(false);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [currentlyPlayingPath, setCurrentlyPlayingPath] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [showRenameIndex, setShowRenameIndex] = useState<number | null>(null);
  const [newName, setNewName] = useState('');
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const playerRef = useRef<Sound | null>(null);
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const waveformCache = useRef<Record<string, number[]>>({});

  useEffect(() => {
    if (Platform.OS === 'android') {
      PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      ]);
    }

    AudioRecord.init({
      sampleRate: 44100,
      channels: 1,
      bitsPerSample: 16,
      audioSource: 6,
      wavFile: 'temp.wav',
    });

    AudioRecord.on('data', (data: string) => {
      const buffer = Buffer.from(data, 'base64');
      const amplitudes = [];
      for (let i = 0; i < buffer.length; i += 2) {
        const amplitude = Math.abs(buffer.readInt16LE(i)) / 32768;
        amplitudes.push(amplitude);
      }
      const avgAmplitude = amplitudes.reduce((a, b) => a + b, 0) / amplitudes.length;
      setWaveformData((prev) => {
        const updated = [...prev, avgAmplitude];
        if (updated.length > MAX_POINTS) updated.shift();
        return updated;
      });
    });

    loadRecordings();

    return () => {
      if (playerRef.current) {
        playerRef.current.release();
      }
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, []);

  // Load recordings AND waveform JSON files
  const loadRecordings = async () => {
    const files = await RNFS.readDir(RNFS.DocumentDirectoryPath);
    const wavFiles = files.filter((f) => f.name.endsWith('.wav'));

    // Load waveform JSON for each wav file, if exists
    for (const file of wavFiles) {
      const waveJsonPath = file.path.replace('.wav', '_wave.json');
      const exists = await RNFS.exists(waveJsonPath);
      if (exists) {
        try {
          const waveContent = await RNFS.readFile(waveJsonPath, 'utf8');
          waveformCache.current[file.path] = JSON.parse(waveContent);
        } catch {
          waveformCache.current[file.path] = [];
        }
      } else {
        waveformCache.current[file.path] = [];
      }
    }

    setRecordings(wavFiles);
  };

  const startRecording = () => {
    setRecording(true);
    setWaveformData([]);
    setCurrentlyPlayingPath(null);
    setPlaybackProgress(0);
    AudioRecord.start();
  };

  const stopRecording = async () => {
    const filePath = await AudioRecord.stop();
    const fileName = `recording_${Date.now()}.wav`;
    const newPath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
    await RNFS.moveFile(filePath, newPath);

    // Save waveform data as JSON alongside audio file
    const waveJsonPath = newPath.replace('.wav', '_wave.json');
    try {
      await RNFS.writeFile(waveJsonPath, JSON.stringify(waveformData), 'utf8');
      waveformCache.current[newPath] = [...waveformData];
    } catch (e) {
      console.error('Error saving waveform JSON:', e);
    }

    setRecording(false);
    loadRecordings();
  };

  const generateWavePath = (points: number[], width: number, height: number) => {
    if (points.length === 0) return '';
    const step = width / points.length;
    let path = `M 0 ${height / 2}`;
    points.forEach((p, i) => {
      const x = i * step;
      const y = height - p * height;
      path += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    });
    path += ` L ${width} ${height} L 0 ${height} Z`;
    return path;
  };

  const playRecording = async (path: string) => {
    if (playerRef.current) {
      playerRef.current.stop();
      playerRef.current.release();
      playerRef.current = null;
    }

    setPlaybackProgress(0);
    setCurrentlyPlayingPath(path);
    setIsPaused(false);

    if (waveformCache.current[path]) {
      setWaveformData(waveformCache.current[path]);
    } else {
      setWaveformData([]);
    }

    const sound = new Sound(path, '', (error) => {
      if (error) {
        console.error('Playback error:', error);
        setCurrentlyPlayingPath(null);
        return;
      }
      playerRef.current = sound;
      sound.play((success) => {
        if (!success) console.log('Playback failed');
        setCurrentlyPlayingPath(null);
        setPlaybackProgress(0);
      });

      if (progressInterval.current) clearInterval(progressInterval.current);
      progressInterval.current = setInterval(() => {
        if (!playerRef.current) return;
        playerRef.current.getCurrentTime((seconds) => {
          const progress = seconds / sound.getDuration();
          setPlaybackProgress(progress);
        });
      }, 100);
    });
  };

  const togglePause = () => {
    if (playerRef.current && currentlyPlayingPath) {
      if (isPaused) {
        playerRef.current.play();
      } else {
        playerRef.current.pause();
      }
      setIsPaused(!isPaused);
    }
  };

  const deleteRecording = async (index: number) => {
    const filePath = recordings[index].path;
    await RNFS.unlink(filePath);
    const waveJsonPath = filePath.replace('.wav', '_wave.json');
    if (await RNFS.exists(waveJsonPath)) {
      await RNFS.unlink(waveJsonPath);
    }
    delete waveformCache.current[filePath];
    if (currentlyPlayingPath === filePath) {
      setCurrentlyPlayingPath(null);
      setPlaybackProgress(0);
      setWaveformData([]);
      if (playerRef.current) {
        playerRef.current.stop();
        playerRef.current.release();
        playerRef.current = null;
      }
    }
    loadRecordings();
  };

  const promptRename = (index: number) => {
    setShowRenameIndex(index);
    setNewName(recordings[index].name.replace('.wav', ''));
  };

  const handleRename = async (index: number) => {
    const oldPath = recordings[index].path;
    const newPath = `${RNFS.DocumentDirectoryPath}/${newName}.wav`;

    await RNFS.moveFile(oldPath, newPath);

    // Also rename waveform JSON file if exists
    const oldWaveJsonPath = oldPath.replace('.wav', '_wave.json');
    const newWaveJsonPath = newPath.replace('.wav', '_wave.json');
    if (await RNFS.exists(oldWaveJsonPath)) {
      await RNFS.moveFile(oldWaveJsonPath, newWaveJsonPath);
      waveformCache.current[newPath] = waveformCache.current[oldPath] || [];
      delete waveformCache.current[oldPath];
    }

    setShowRenameIndex(null);
    setNewName('');
    loadRecordings();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Audio Recorder with Waveform</Text>
      <View style={styles.waveContainer}>
        <Svg width={SCREEN_WIDTH} height={WAVEFORM_HEIGHT}>
          <Path
            d={generateWavePath(waveformData, SCREEN_WIDTH, WAVEFORM_HEIGHT)}
            fill="blueviolet"
            opacity={0.5}
          />
          {currentlyPlayingPath && (
            <Line
              x1={(SCREEN_WIDTH * playbackProgress).toFixed(2)}
              y1="0"
              x2={(SCREEN_WIDTH * playbackProgress).toFixed(2)}
              y2={WAVEFORM_HEIGHT}
              stroke="red"
              strokeWidth="2"
            />
          )}
        </Svg>
        {currentlyPlayingPath && (
          <Text style={styles.playingFileName}>
            {recordings.find(r => r.path === currentlyPlayingPath)?.name || ''}
          </Text>
        )}
        {recording && (
          <Text style={styles.recordingText}>Recording...</Text>
        )}
      </View>

      <Button
        title={recording ? 'Stop Recording' : 'Start Recording'}
        onPress={recording ? stopRecording : startRecording}
      />

      <FlatList
        data={recordings}
        keyExtractor={(item) => item.path}
        renderItem={({ item, index }) => (
          <View style={styles.recordingItem}>
            {showRenameIndex === index ? (
              <View style={styles.renameBox}>
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  style={styles.input}
                />
                <Button title="Save" onPress={() => handleRename(index)} />
              </View>
            ) : (
              <Text style={styles.fileName}>{item.name}</Text>
            )}

            <View style={styles.buttonRow}>
              <TouchableOpacity onPress={() => playRecording(item.path)}>
                <Text style={styles.playButton}>▶️ Play</Text>
              </TouchableOpacity>
              {currentlyPlayingPath === item.path && (
                <TouchableOpacity onPress={togglePause}>
                  <Text style={styles.playButton}>{isPaused ? '⏯️ Resume' : '⏸️ Pause'}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => promptRename(index)}>
                <Text style={styles.renameButton}>✏️ Rename</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteRecording(index)}>
                <Text style={styles.deleteButton}>🗑️ Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
};

export default AudioWaveformRecorder;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 10,
    backgroundColor: '#f9f9f9',
  },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  waveContainer: {
    height: WAVEFORM_HEIGHT + 50,
    marginBottom: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingText: {
    color: 'red',
    marginTop: 10,
    fontWeight: 'bold',
  },
  playingFileName: {
    marginTop: 5,
    fontSize: 14,
    fontStyle: 'italic',
  },
  recordingItem: {
    backgroundColor: '#fff',
    borderRadius: 5,
    marginVertical: 6,
    padding: 8,
    elevation: 1,
  },
  fileName: {
    fontSize: 16,
    marginBottom: 6,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  playButton: {
    fontSize: 18,
    color: 'green',
  },
  renameButton: {
    fontSize: 18,
    color: 'blue',
  },
  deleteButton: {
    fontSize: 18,
    color: 'red',
  },
  renameBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  input: {
    flex: 1,
    borderBottomWidth: 1,
    marginRight: 10,
    fontSize: 16,
  },
});
