import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PermissionsAndroid,
  Platform,
  Alert,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  Vibration,
} from 'react-native';
import {
  useSoundRecorder,
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
} from 'react-native-nitro-sound';

export interface VoiceRecorderProps {
  onRecordingComplete: (audioPath: string, duration: number) => void;
  onRecordingCanceled: () => void;
}

type RecordingState = 'idle' | 'preparing' | 'recording' | 'canceling';

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onRecordingComplete,
  onRecordingCanceled,
}) => {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const startTimeRef = useRef<number>(0);
  const filePathRef = useRef<string | null>(null);
  
  // To handle the race condition where user releases before recording starts
  const shouldContinueRecordingRef = useRef(false);

  const { startRecorder, stopRecorder } = useSoundRecorder({
    subscriptionDuration: 0.1,
    onRecord: (event) => {
        if (!event.isRecording) return;
        
        // currentPosition is in ms
        const currentDuration = event.currentPosition;
        setDuration(currentDuration);

        // Auto-stop at 60 seconds
        if (currentDuration >= 60000) {
            handleAutoStop();
        }
    },
  });

  const checkPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    try {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );
      if (granted) return true;

      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: '麦克风权限申请',
          message: 'App需要访问您的麦克风以发送语音消息',
          buttonNeutral: '稍后询问',
          buttonNegative: '拒绝',
          buttonPositive: '确定',
        }
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn(err);
      return false;
    }
  };

  const startRecording = async () => {
    try {
      const hasPermission = await checkPermission();
      if (!hasPermission) {
        Alert.alert('权限不足', '需要麦克风权限才能录音');
        setRecordingState('idle');
        return;
      }

      if (!shouldContinueRecordingRef.current) {
          // User released while asking for permission
          setRecordingState('idle');
          return;
      }

      // Vibrate to indicate start
      Vibration.vibrate(50);

      const path = await startRecorder(undefined, {
        AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
        AudioSourceAndroid: AudioSourceAndroidType.MIC,
        AudioSamplingRate: 44100,
        AudioEncodingBitRate: 128000,
        AudioChannels: 1,
      }, true);
      
      console.log('Recording started at path:', path);
      filePathRef.current = path;
      startTimeRef.current = Date.now();
      
      // If user canceled while startRecorder was resolving
      if (!shouldContinueRecordingRef.current) {
          await stopRecorder();
          setRecordingState('idle');
          return;
      }

      setRecordingState('recording');
    } catch (error) {
      console.error('Failed to start recording:', error);
      setRecordingState('idle');
      Alert.alert('录音失败', '无法启动录音');
    }
  };

  const handleAutoStop = async () => {
      // Prevent multiple calls
      if (recordingState === 'idle') return;
      
      Alert.alert('提示', '录音时长已达上限');
      await stopAndSend();
  };

  const stopAndSend = async () => {
    try {
        const finalPath = await stopRecorder();
        const endTime = Date.now();
        // Fallback duration calculation if event didn't fire enough times
        const finalDuration = duration > 0 ? duration : (endTime - startTimeRef.current);

        setRecordingState('idle');
        setDuration(0);

        if (finalDuration < 1000) {
             Alert.alert('提示', '说话时间太短');
             return;
        }
        
        // Use the path from startRecorder if stopRecorder doesn't return one (depends on library version, usually it returns same path)
        const path = finalPath || filePathRef.current;
        if (path) {
            onRecordingComplete(path, finalDuration);
        }
    } catch (error) {
        console.error('Error stopping recorder:', error);
        setRecordingState('idle');
    }
  };

  const cancelRecording = async () => {
      try {
          await stopRecorder();
          setRecordingState('idle');
          setDuration(0);
          onRecordingCanceled();
          // Vibrate to confirm cancel
          Vibration.vibrate([0, 50, 50, 50]);
      } catch (error) {
          console.error('Error canceling recorder:', error);
          setRecordingState('idle');
      }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: async () => {
        shouldContinueRecordingRef.current = true;
        setRecordingState('preparing');
        await startRecording();
      },
      onPanResponderMove: (_, gestureState) => {
        // If we are preparing, we just track the state but don't cancel yet? 
        // Or we can pre-emptively show cancel state.
        if (shouldContinueRecordingRef.current) {
            if (gestureState.dy < -100) {
                setRecordingState((prev) => prev === 'recording' ? 'canceling' : prev);
            } else {
                setRecordingState((prev) => prev === 'canceling' ? 'recording' : prev);
            }
        }
      },
      onPanResponderRelease: async (_, gestureState) => {
        shouldContinueRecordingRef.current = false;
        
        if (recordingState === 'idle') return; // Already stopped or failed

        if (gestureState.dy < -100 || recordingState === 'canceling') {
            await cancelRecording();
        } else {
            // If still preparing, we wait? No, startRecording checks shouldContinueRecordingRef
            // If we are 'recording', we stop and send.
            if (recordingState === 'recording') {
                await stopAndSend();
            } else if (recordingState === 'preparing') {
                // If released while preparing, startRecording will handle cleanup via ref
                console.log('Released while preparing');
            }
        }
      },
      onPanResponderTerminate: async () => {
          shouldContinueRecordingRef.current = false;
          await cancelRecording();
      },
    })
  ).current;

  // Render helpers
  const getButtonText = () => {
      switch (recordingState) {
          case 'idle': return '按住 说话';
          case 'preparing': return '准备中...';
          case 'recording': return '松开 发送';
          case 'canceling': return '松开手指，取消发送';
      }
  };

  const formatDuration = (ms: number) => {
      const seconds = Math.floor(ms / 1000);
      return `${seconds}"`;
  };

  return (
    <View style={styles.container}>
      {/* Overlay Indicator (only when active) */}
      {(recordingState === 'recording' || recordingState === 'canceling') && (
          <View style={[
              styles.overlay, 
              recordingState === 'canceling' ? styles.overlayCancel : styles.overlayRecord
          ]}>
              <Text style={styles.overlayIcon}>
                  {recordingState === 'canceling' ? '↩️' : '🎤'}
              </Text>
              <Text style={styles.overlayText}>
                  {recordingState === 'canceling' ? '松开手指\n取消发送' : '手指上滑\n取消发送'}
              </Text>
              {recordingState === 'recording' && (
                  <Text style={styles.durationText}>{formatDuration(duration)}</Text>
              )}
          </View>
      )}

      {/* Button Area */}
      <View style={styles.buttonContainer}>
          <View
            {...panResponder.panHandlers}
            style={[
                styles.recordButton,
                recordingState !== 'idle' && styles.recordButtonPressed,
                recordingState === 'canceling' && styles.recordButtonCancel
            ]}
          >
             <Text style={styles.buttonIcon}>🎤</Text>
             <Text style={[
                 styles.buttonText,
                 recordingState === 'canceling' && styles.buttonTextCancel
             ]}>
                 {getButtonText()}
             </Text>
          </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  buttonContainer: {
      width: '100%',
      paddingHorizontal: 20,
      alignItems: 'center',
  },
  recordButton: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F5F5F5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  recordButtonPressed: {
      backgroundColor: '#C8C8C8',
  },
  recordButtonCancel: {
      backgroundColor: '#FFEBEE', // Light red
  },
  buttonIcon: {
      fontSize: 16,
      marginRight: 8,
      color: '#333',
  },
  buttonText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#333',
  },
  buttonTextCancel: {
      color: '#D32F2F',
  },
  // Overlay styles
  overlay: {
      position: 'absolute',
      bottom: 100, // Position above the button
      width: 160,
      height: 160,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
  },
  overlayRecord: {
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  overlayCancel: {
      backgroundColor: 'rgba(211, 47, 47, 0.8)', // Red semi-transparent
  },
  overlayIcon: {
      fontSize: 48,
      color: 'white',
      marginBottom: 10,
  },
  overlayText: {
      color: 'white',
      fontSize: 14,
      textAlign: 'center',
      marginBottom: 5,
  },
  durationText: {
      color: 'white',
      fontSize: 16,
      marginTop: 5,
  }
});
