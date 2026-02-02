import React, { useState } from 'react';

const RoomControls = ({ onJoinRoom, onVideoSelect, joinedRoom, onLeaveRoom }) => {
    const [roomId, setRoomId] = useState('');
    const [videoUrl, setVideoUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleJoin = () => {
        if (roomId.trim()) {
            onJoinRoom(roomId);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            onVideoSelect(url, 'file', file); // Pass file object
        }
    };

    const handleUrlSubmit = async () => {
        if (!videoUrl.trim()) return;

        setIsLoading(true);

        // Simple type detection
        let type = 'url';
        const val = videoUrl.trim();
        if (val.startsWith('magnet:?')) type = 'magnet';
        else if (val.match(/^[a-zA-Z]:\\/) || val.startsWith('/')) type = 'file';

        try {
            // Send to Local Agent
            const res = await fetch('http://localhost:3000/play', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: val, type })
            });

            const data = await res.json();

            if (data.success) {
                // Construct stream URL
                const streamUrl = `http://localhost:3000/stream/${data.streamId}`;
                console.log("Playing via Agent:", streamUrl);
                onVideoSelect(streamUrl, 'url');
            } else {
                alert("Agent Error: " + (data.error || 'Unknown error'));
            }
        } catch (err) {
            console.error("Agent Connection Error:", err);
            // Fallback? Or just alert.
            // For now, let's alert because this feature depends on the agent.
            alert("Failed to connect to Local Agent (port 3000). Ensure it's running.");

            // Backup: Try direct play if it was a simple URL (might fail CORS but better than nothing?)
            // onVideoSelect(val, 'url'); 
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ width: '100%', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
            {!joinedRoom ? (
                <div className="animate-fade-in">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
                        <input
                            type="text"
                            placeholder="enter room name..."
                            value={roomId}
                            onChange={(e) => setRoomId(e.target.value)}
                            autoFocus
                        />
                        <div style={{ display: 'flex', gap: '20px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            <button className="primary-btn" onClick={handleJoin}>join / create</button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="animate-fade-in" style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <div style={{ marginBottom: '20px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
                        <span>room: <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{joinedRoom}</span></span>
                        <button
                            onClick={onLeaveRoom}
                            style={{
                                background: 'rgba(255, 23, 68, 0.1)',
                                color: '#ff1744', // Red color
                                border: '1px solid rgba(255, 23, 68, 0.3)',
                                fontSize: '0.7rem',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                            title="Discard / Leave Room"
                        >
                            ✖ leave
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', alignItems: 'center' }}>
                        <div style={{ width: '100%' }}>
                            <input type="file" accept="video/*" onChange={handleFileChange} style={{ width: '100%' }} />
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '5px' }}>click to select local file</p>
                        </div>

                        <div style={{ width: '100%', borderTop: '1px solid var(--text-muted)', opacity: 0.3 }}></div>

                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                            <input
                                type="text"
                                placeholder="paste url, magnet link, or file path..."
                                value={videoUrl}
                                onChange={(e) => setVideoUrl(e.target.value)}
                                style={{ fontSize: '1rem', width: '100%' }}
                                onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                            />
                            <button
                                onClick={handleUrlSubmit}
                                disabled={isLoading}
                                style={{ marginTop: '10px', alignSelf: 'center', opacity: isLoading ? 0.7 : 1 }}
                            >
                                {isLoading ? 'requesting stream...' : 'load'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RoomControls;
