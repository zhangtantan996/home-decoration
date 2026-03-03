import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { useSound } from 'react-native-nitro-sound';
import { Play, Pause } from 'lucide-react-native';
import { useAudioPlayerStore } from '../store/audioPlayerStore';
import { colors } from '../theme/tokens';

const PRIMARY_GOLD = colors.brand;

interface AudioPlayerProps {
    messageId: string;
    audioUrl: string;
    duration: number; // milliseconds
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ messageId, audioUrl, duration: initialDuration }) => {
    const { currentPlayingId, play, stop } = useAudioPlayerStore();
    const isFocused = currentPlayingId === messageId;
    
    const [currentPosition, setCurrentPosition] = React.useState(0);
    const [duration, setDuration] = React.useState(initialDuration);

    const {
        startPlayer,
        stopPlayer,
        pausePlayer,
        resumePlayer,
        seekToPlayer,
        state,
        mmssss,
    } = useSound({
        subscriptionDuration: 0.1,
        onPlayback: (event) => {
             if (typeof event.currentPosition === 'number') {
                 setCurrentPosition(event.currentPosition);
             }
             if (event.duration > 0) {
                 setDuration(event.duration);
             }
        },
        onPlaybackEnd: () => {
            setCurrentPosition(0);
            if (isFocused) {
                stop();
            }
        },
    });

    useEffect(() => {
        if (!isFocused && state.isPlaying) {
            stopPlayer();
            setCurrentPosition(0);
        }
    }, [isFocused, state.isPlaying, stopPlayer]);

    useEffect(() => {
        return () => {
            if (currentPlayingId === messageId) {
                stop();
            }
        };
    }, [currentPlayingId, messageId, stop]);

    const handlePlayPause = async () => {
        if (state.isPlaying) {
            await pausePlayer();
        } else {
            if (!isFocused) {
                play(messageId);
                await startPlayer(audioUrl);
            } else {
                if (currentPosition > 0 && currentPosition < duration) {
                    await resumePlayer();
                } else {
                    await startPlayer(audioUrl);
                }
            }
        }
    };

    const displayDuration = duration > 0 ? duration : initialDuration;
    const progress = displayDuration > 0 ? currentPosition / displayDuration : 0;
    const clampedProgress = Math.min(Math.max(progress, 0), 1);

    const formatTime = (ms: number) => {
        if (!ms || ms < 0) return '00:00';
        if (mmssss) return mmssss(ms);
        
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const [barWidth, setBarWidth] = React.useState(0);

    const onSeekPress = async (e: any) => {
        if (barWidth > 0 && displayDuration > 0) {
            const x = e.nativeEvent.locationX;
            const percent = x / barWidth;
            const seekTime = percent * displayDuration;
            
            setCurrentPosition(seekTime);

            if (!isFocused) {
                play(messageId);
                await startPlayer(audioUrl); 
            }
            
            await seekToPlayer(seekTime);
        }
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity onPress={handlePlayPause} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                {state.isPlaying ? (
                    <Pause size={20} color="#333" fill="#333" />
                ) : (
                    <Play size={20} color="#333" fill="#333" />
                )}
            </TouchableOpacity>

            <Pressable 
                style={styles.progressContainer} 
                onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
                onPress={onSeekPress}
            >
                <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${clampedProgress * 100}%` }]} />
                    <View style={[styles.thumb, { left: `${clampedProgress * 100}%` }]} />
                </View>
            </Pressable>

            <Text style={styles.duration}>
                {formatTime(currentPosition)} / {formatTime(displayDuration)}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.gray100,
        borderRadius: 8,
        padding: 8,
        paddingHorizontal: 12,
        width: 240,
        height: 50,
    },
    progressContainer: {
        flex: 1,
        height: 30,
        justifyContent: 'center',
        marginHorizontal: 10,
    },
    progressBar: {
        height: 4,
        backgroundColor: colors.gray300,
        borderRadius: 2,
        width: '100%',
        position: 'relative',
    },
    progressFill: {
        height: '100%',
        backgroundColor: PRIMARY_GOLD,
        borderRadius: 2,
    },
    thumb: {
        position: 'absolute',
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: PRIMARY_GOLD,
        top: -4,
        marginLeft: -6,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.20,
        shadowRadius: 1.41,
        elevation: 2,
    },
    duration: {
        fontSize: 12,
        color: colors.gray600,
        fontVariant: ['tabular-nums'],
    },
});
