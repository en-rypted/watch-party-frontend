import React, { useState, useEffect } from 'react';
import socket from '../socket';

// Default Port used by Agent
const DEFAULT_AGENT_PORT = 3000;

const LocalTransfer = ({ isHost, roomId, onFileReceived, fileToShare }) => {
    const [agentStatus, setAgentStatus] = useState(null); // { online, port, activeFile, ip }
    const [customPort, setCustomPort] = useState(DEFAULT_AGENT_PORT);
    const [remoteAgent, setRemoteAgent] = useState(null); // peer agent info
    const [downloads, setDownloads] = useState([]); // track downloads
    const [downloadProgress, setDownloadProgress] = useState(0); // agent download progress
    const [downloadSpeed, setDownloadSpeed] = useState(0); // agent download speed in MB/s

    // Poll Local Agent
    useEffect(() => {
        const checkAgent = async () => {
            try {
                const res = await fetch(`http://127.0.0.1:${customPort}/status`);
                const data = await res.json();
                setAgentStatus({ ...data, port: customPort });

                // If we are not connected to the cloud via Agent, tell it to join?
                if (data.online && (!data.room || data.room !== roomId)) {
                    await fetch(`http://127.0.0.1:${customPort}/join-room`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ roomId })
                    });
                }

            } catch (err) {
                setAgentStatus(null);
            }
        };

        const interval = setInterval(checkAgent, 2000);
        checkAgent(); // Initial check
        return () => clearInterval(interval);
    }, [customPort, roomId]);

    // Listen for Remote Agent Announcements
    useEffect(() => {
        const handleAgentAnnounce = (data) => {
            // data: { roomId, file: { id, name, size, ip, port } }
            console.log("Remote Agent Announced:", data);
            if (data.roomId === roomId) {
                setRemoteAgent(data.file);
            }
        };

        // Listen for user join to re-announce (if Host)
        const handleUserJoined = () => {
            if (isHost && agentStatus && agentStatus.activeFile) {
                console.log("User joined, re-announcing file...");
                socket.emit('agent_file_announce', {
                    roomId,
                    file: {
                        id: agentStatus.activeFile.id || Date.now().toString(),
                        name: agentStatus.activeFile.name,
                        size: agentStatus.activeFile.size,
                        ip: agentStatus.ip,
                        port: agentStatus.port
                    }
                });
            }
        };

        socket.on('agent_file_announce', handleAgentAnnounce);
        socket.on('user_joined', handleUserJoined);

        // Listen for download progress from agent
        const handleDownloadProgress = (data) => {
            if (data.roomId === roomId) {
                console.log('Download progress:', data.progress, 'Speed:', data.speed);
                setDownloadProgress(data.progress);
                setDownloadSpeed(data.speed || 0);

                // When download completes, start playback
                if (data.progress === 100) {
                    const playbackUrl = `http://127.0.0.1:${customPort}/downloads/${data.fileName}`;
                    console.log("Download complete! Playing from:", playbackUrl);
                    onFileReceived(playbackUrl);

                    setTimeout(() => {
                        setDownloadProgress(0);
                        setDownloadSpeed(0);
                    }, 2000); // Reset after 2s
                }
            }
        };
        socket.on('agent_download_progress', handleDownloadProgress);

        return () => {
            socket.off('agent_file_announce', handleAgentAnnounce);
            socket.off('user_joined', handleUserJoined);
            socket.off('agent_download_progress', handleDownloadProgress);
        };
    }, [roomId, isHost, agentStatus]);


    const handleSelectFile = async () => {
        const path = prompt("Enter full file path to share (e.g. C:\\Videos\\movie.mp4):");
        if (!path) return;

        try {
            const res = await fetch(`http://127.0.0.1:${customPort}/select-file`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath: path })
            });
            const data = await res.json();
            if (data.success) {
                alert(`File selected: ${data.file.name}`);

                // HOST PLAYBACK: Stream directly from own Agent
                // We know the file ID and our own port.
                // data.file.id is set by agent.
                const streamUrl = `http://127.0.0.1:${customPort}/stream/${data.file.id}`;
                console.log("Host loading stream:", streamUrl);
                onFileReceived(streamUrl); // Auto-play for Host

            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (err) {
            alert("Failed to communicate with Local Agent");
        }
    };

    const handleDownload = async () => {
        if (!remoteAgent || !agentStatus) return;

        // Construct target URL (Agent to Agent)
        const targetUrl = `http://${remoteAgent.ip}:${remoteAgent.port}/stream/${remoteAgent.id}`;

        try {
            const res = await fetch(`http://127.0.0.1:${customPort}/start-download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetUrl,
                    fileName: remoteAgent.name
                })
            });
            const data = await res.json();
            if (data.success) {
                alert(`Download started! \nFile will auto-play when ready.`);
                setDownloads(prev => [...prev, remoteAgent.name]);
                console.log("Download initiated for:", remoteAgent.name);


            } else {
                alert(`Download failed: ${data.error}`);
            }
        } catch (err) {
            alert("Agent Error");
        }
    };

    if (!agentStatus) {
        return (
            <div className="card glass-panel" style={{ textAlign: 'center', padding: '20px' }}>
                <h3 style={{ color: '#f44336' }}>⚠️ Local Agent Not Detected</h3>
                <p style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: '15px' }}>
                    This feature requires the <b>Chitrakatha Agent</b> to be running.
                </p>

                {/* Placeholder for GitHub Releases download link */}
                <a
                    href="https://github.com/en-rypted/chitrakatha_agent/releases/latest/download/chitrakatha_agent.exe"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="primary-btn"
                    style={{
                        display: 'inline-block',
                        textDecoration: 'none',
                        marginBottom: '20px',
                        background: '#2196f3'
                    }}
                >
                    📥 Download Windows Agent (GitHub)
                </a>

                <div style={{ marginTop: '10px', width: '100%', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' }}>
                    <p style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '5px' }}>Already running?</p>
                    <label style={{ fontSize: '0.8rem' }}>Agent Port: </label>
                    <input
                        type="number"
                        value={customPort}
                        onChange={(e) => setCustomPort(e.target.value)}
                        style={{
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid var(--primary)',
                            color: 'white',
                            padding: '5px',
                            width: '80px',
                            borderRadius: '4px'
                        }}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="card glass-panel" style={{ textAlign: 'center', padding: '20px', marginTop: '20px', maxWidth: '100%', overflow: 'hidden' }}>
            <h3 style={{ color: '#4caf50', margin: '0 0 10px 0' }}>
                ✅ Local Agent Active
                <span style={{ fontSize: '0.7rem', marginLeft: '10px', opacity: 0.6 }}>Port: {agentStatus.port}</span>
            </h3>

            {/* Host Controls */}
            {isHost && (
                <div style={{ marginBottom: '20px' }}>
                    <div style={{
                        background: 'rgba(255, 152, 0, 0.1)',
                        border: '1px solid rgba(255, 152, 0, 0.3)',
                        padding: '10px',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        marginBottom: '15px',
                        textAlign: 'left'
                    }}>
                        <strong>Why select again?</strong><br />
                        Browser security hides real paths. Agent needs the full path to stream.
                    </div>

                    <button onClick={handleSelectFile} className="primary-btn">
                        📂 Select File from Disk
                    </button>
                    {agentStatus.activeFile && (
                        <p style={{
                            fontSize: '0.9rem',
                            marginTop: '10px',
                            color: 'var(--primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '100%'
                        }} title={agentStatus.activeFile.name}>
                            Sharing: {agentStatus.activeFile.name}
                        </p>
                    )}
                </div>
            )}

            {/* Viewer Controls */}
            {!isHost && remoteAgent && (
                <div>
                    <p style={{ marginBottom: '10px' }}>
                        Host is sharing: <br />
                        <b style={{
                            color: 'var(--secondary)',
                            display: 'block',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '280px',
                            margin: '0 auto'
                        }} title={remoteAgent.name}>
                            {remoteAgent.name}
                        </b>
                        <span style={{ fontSize: '0.8rem', opacity: 0.7 }}> ({(remoteAgent.size / 1024 / 1024).toFixed(1)} MB)</span>
                    </p>

                    <div style={{ marginTop: '15px' }}>
                        <button onClick={handleDownload} style={{ width: '100%' }} className="secondary-btn">
                            ⬇️ Download to Disk & Play
                        </button>

                        {downloadProgress > 0 && downloadProgress < 100 && (
                            <div style={{ marginTop: '10px' }}>
                                <div style={{
                                    width: '100%',
                                    height: '8px',
                                    background: 'rgba(255,255,255,0.1)',
                                    borderRadius: '4px',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{
                                        width: `${downloadProgress}%`,
                                        height: '100%',
                                        background: 'linear-gradient(90deg, var(--primary), var(--accent))',
                                        transition: 'width 0.3s ease',
                                        borderRadius: '4px'
                                    }} />
                                </div>
                                <p style={{ fontSize: '0.8rem', marginTop: '5px', opacity: 0.8 }}>
                                    Downloading: {downloadProgress}%
                                    {downloadSpeed > 0 && <span style={{ marginLeft: '10px', opacity: 0.6 }}>({downloadSpeed.toFixed(2)} MB/s)</span>}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {!isHost && !remoteAgent && (
                <p style={{ opacity: 0.6 }}>Waiting for host to select a file...</p>
            )}

            {downloads.length > 0 && (
                <div style={{ marginTop: '15px', fontSize: '0.8rem', textAlign: 'left', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '4px' }}>
                    <strong>Recent Downloads:</strong>
                    <ul style={{ margin: '5px 0 0 20px', padding: 0 }}>
                        {downloads.map((d, i) => <li key={i} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{d}</li>)}
                    </ul>
                    <p style={{ margin: '8px 0 0 0', opacity: 0.6, fontSize: '0.75rem' }}>
                        📁 Saved to: <code>%TEMP%\chitrakatha_downloads\</code>
                    </p>
                </div>
            )}
        </div>
    );
};

export default LocalTransfer;
