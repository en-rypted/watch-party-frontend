import React, { useRef, useEffect } from 'react';
import socket from '../socket';

// Flag to prevent infinite loops when programmatic update triggers event listeners
let isRemoteUpdate = false;

const VideoPlayer = ({ src, roomId, isHost, autoResume }) => {
    const videoRef = useRef(null);
    const lastTimeRef = useRef(0);
    const wasPlayingRef = useRef(false);

    // Handle seamless transition
    useEffect(() => {
        if (!videoRef.current) return;
        const video = videoRef.current;

        // Save state before src change (this runs cleanup before new src effect)
        return () => {
            if (autoResume) {
                lastTimeRef.current = video.currentTime;
                wasPlayingRef.current = !video.paused;
                console.log(`[VideoPlayer] Saving state: Time=${lastTimeRef.current}, Playing=${wasPlayingRef.current}`);
            }
        };
    }, [src, autoResume]);

    // Restore state after src load
    const handleLoadedMetadata = () => {
        const video = videoRef.current;
        console.log(`[VideoPlayer] Metadata loaded - Duration: ${video.duration}s`);

        if (autoResume && lastTimeRef.current > 0) {
            console.log(`[VideoPlayer] Restoring state: Seek to ${lastTimeRef.current}`);
            video.currentTime = lastTimeRef.current;
            if (wasPlayingRef.current) {
                video.play().catch(e => console.log("Auto-resume blocked:", e));
            }
        }
    };

    // Detect duration changes (for torrents that start with duration=0)
    const handleDurationChange = () => {
        const video = videoRef.current;
        if (video && video.duration > 0 && video.duration !== Infinity) {
            console.log(`[VideoPlayer] Duration updated: ${Math.round(video.duration / 60)} minutes (${video.duration}s)`);
        }
    };

    useEffect(() => {
        // Only run this effect if we have a video element AND we are in a room
        if (!videoRef.current || !roomId) return;

        const video = videoRef.current;
        console.log(`VideoPlayer: Attached listeners for Room ${roomId}`);

        // --- Socket Event Listeners ---
        const handleSyncAction = (data) => {
            console.log('VideoPlayer: Received sync_action:', data);
            if (data.roomId !== roomId) return;

            isRemoteUpdate = true; // Set flag before modifying video

            const timeDiff = Math.abs(video.currentTime - data.time);

            if (data.action === 'PLAY') {
                // Only seek if drifted significantly to avoid jumping
                if (timeDiff > 0.5) video.currentTime = data.time;

                // Safely attempt play
                const playPromise = video.play();
                if (playPromise !== undefined) {
                    playPromise.catch(e => {
                        console.log("Auto-play blocked:", e.name, e.message);
                        // Ignored locally or show toast? 
                        // For now we just supress the red console error
                    });
                }
            } else if (data.action === 'PAUSE') {
                if (timeDiff > 0.5) video.currentTime = data.time;
                video.pause();
            } else if (data.action === 'SEEK') {
                video.currentTime = data.time;
            }

            // Short timeout to reset flag
            setTimeout(() => {
                isRemoteUpdate = false;
            }, 500); // 100ms might be too short for some async player events? increasing to 500
        };

        const handleSyncTime = (data) => {
            if (data.roomId !== roomId) return;
            // Drift correction for clients
            const timeDiff = Math.abs(video.currentTime - data.time);
            if (timeDiff > 1.0) { // Increased threshold to 1.0s to be less aggressive
                console.log(`Drift correction: seeking ${video.currentTime} -> ${data.time}`);
                isRemoteUpdate = true;
                video.currentTime = data.time;
                setTimeout(() => { isRemoteUpdate = false; }, 500);
            }
        };

        socket.on('sync_action', handleSyncAction);
        socket.on('sync_time', handleSyncTime);

        return () => {
            console.log(`VideoPlayer: Detaching listeners for Room ${roomId}`);
            socket.off('sync_action', handleSyncAction);
            socket.off('sync_time', handleSyncTime);
        };
    }, [roomId, src]); // Added src to dependencies

    const emitAction = (action) => {
        if (isRemoteUpdate) return;
        if (!roomId) return;

        const video = videoRef.current;
        socket.emit('sync_action', {
            roomId,
            action,
            time: video.currentTime
        });
    };

    const handlePlay = () => emitAction('PLAY');
    const handlePause = () => emitAction('PAUSE');
    const handleSeeked = () => emitAction('SEEK');

    // --- Drift Correction (Host side) ---
    useEffect(() => {
        let interval;
        if (isHost && roomId) {
            interval = setInterval(() => {
                if (videoRef.current && !videoRef.current.paused) {
                    socket.emit('sync_time', {
                        roomId,
                        time: videoRef.current.currentTime
                    });
                }
            }, 5000); // Every 5 seconds
        }
        return () => clearInterval(interval);
    }, [isHost, roomId]);

    return (
        <div className="video-player-container">
            {src ? (
                <div>
                    <video
                        ref={videoRef}
                        src={src}
                        controls
                        width="100%"
                        onPlay={handlePlay}
                        onPause={handlePause}
                        onSeeked={handleSeeked}
                        onLoadedMetadata={handleLoadedMetadata}
                        onDurationChange={handleDurationChange}
                        onError={(e) => {
                            console.error("Video Error:", e.target.error);
                        }}
                        style={{ backgroundColor: '#000', display: 'block' }}
                    />
                    {/* Optional: Add an error overlay state if needed, but for now simple log */}
                </div>
            ) : (
                <div style={{ padding: '20px', textAlign: 'center', background: '#eee' }}>
                    No video loaded. Select a file or URL above.
                </div>
            )}
        </div>
    );
};

export default VideoPlayer;
