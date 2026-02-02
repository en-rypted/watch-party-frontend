import React, { useState } from 'react';
import { searchContent, getMeta, getStreams } from '../services/stremio';

const TorrentSearch = ({ onPlay }) => {
    const [query, setQuery] = useState('');
    const [type, setType] = useState('movie');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [streams, setStreams] = useState([]);
    const [loadingStreams, setLoadingStreams] = useState(false);

    const [seasons, setSeasons] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState(null);
    const [episodes, setEpisodes] = useState([]);
    const [selectedEpisode, setSelectedEpisode] = useState(null);

    const [preparingStream, setPreparingStream] = useState(false);
    const [streamStatus, setStreamStatus] = useState('');

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setSelectedItem(null);
        setStreams([]);
        setResults([]);
        setSeasons([]);
        setSelectedSeason(null);
        setEpisodes([]);
        setSelectedEpisode(null);

        const content = await searchContent(query, type);
        setResults(content);
        setLoading(false);
    };

    const handleSelect = async (item) => {
        setSelectedItem(item);
        setLoadingStreams(true);
        setSeasons([]);
        setSelectedSeason(null);
        setEpisodes([]);
        setSelectedEpisode(null);
        setStreams([]);

        const meta = await getMeta(item.imdb_id, item.type);
        const fullItem = meta || item;
        setSelectedItem(fullItem);

        if (item.type === 'series') {
            if (fullItem.videos && Array.isArray(fullItem.videos)) {
                const uniqueSeasons = [...new Set(fullItem.videos.filter(v => v.season).map(v => v.season))].sort((a, b) => a - b);
                setSeasons(uniqueSeasons);
            }
            setLoadingStreams(false);
        } else {
            const fetchedStreams = await getStreams(item.imdb_id, item.type);
            setStreams(fetchedStreams);
            setLoadingStreams(false);
        }
    };

    const handleSeasonSelect = (season) => {
        setSelectedSeason(season);
        if (selectedItem && selectedItem.videos) {
            const seasonEpisodes = selectedItem.videos.filter(v => v.season === season).sort((a, b) => a.episode - b.episode);
            setEpisodes(seasonEpisodes);
        }
    };

    const handleEpisodeSelect = async (episode) => {
        setSelectedEpisode(episode);
        setLoadingStreams(true);
        const fetchedStreams = await getStreams(episode.id, 'series');
        setStreams(fetchedStreams);
        setLoadingStreams(false);
    };

    const backToSeries = () => {
        setStreams([]);
        setSelectedEpisode(null);
        setEpisodes([]);
        setSelectedSeason(null);
    };

    const handleStreamClick = async (stream) => {
        let magnet = stream.url;
        if (!magnet && stream.infoHash) {
            magnet = `magnet:?xt=urn:btih:${stream.infoHash}&dn=${encodeURIComponent(selectedItem.name)}`;
        }

        if (magnet) {
            // Show loading overlay
            setPreparingStream(true);
            setStreamStatus('Connecting to local agent...');

            // Simulate progress updates
            const progressTimer = setInterval(() => {
                setStreamStatus(prev => {
                    if (prev === 'Connecting to local agent...') return 'Resolving magnet link...';
                    if (prev === 'Resolving magnet link...') return 'Finding peers (this may take a moment)...';
                    if (prev === 'Finding peers (this may take a moment)...') return 'Downloading metadata...';
                    return prev;
                });
            }, 3000);

            const warningTimer = setTimeout(() => {
                setStreamStatus(prev => prev + ' \n(Taking longer than expected. Low seeds?)');
            }, 15000);

            // Pass the magnet link to the parent (App.jsx)
            // which will handle syncing to room and processing via local agent
            onPlay(magnet, 'magnet');

            // Keep loading for a bit to show feedback, then auto-hide
            setTimeout(() => {
                clearInterval(progressTimer);
                clearTimeout(warningTimer);
                setPreparingStream(false);
                setStreamStatus('');
            }, 5000); // Hide after 5 seconds
        } else {
            alert('No playable URL/Magnet found for this stream.');
        }
    };

    return (
        <div className="torrent-search-container animate-fade-in" style={{ width: '95%', margin: '0 2.5%', paddingBottom: '50px' }}>

            {/* Search Header */}
            {!selectedItem && (
                <div className="search-sticky-header">
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            type="button"
                            onClick={() => setType('movie')}
                            style={{
                                color: type === 'movie' ? 'var(--primary)' : 'var(--text-muted)',
                                borderBottom: type === 'movie' ? '2px solid var(--primary)' : '2px solid transparent',
                                padding: '5px 0',
                                borderRadius: 0,
                                fontWeight: 'bold',
                                textDecoration: 'none',
                                background: 'transparent',
                                fontSize: '1rem',
                                cursor: 'pointer'
                            }}
                        >
                            MOVIES
                        </button>
                        <button
                            type="button"
                            onClick={() => setType('series')}
                            style={{
                                color: type === 'series' ? 'var(--primary)' : 'var(--text-muted)',
                                borderBottom: type === 'series' ? '2px solid var(--primary)' : '2px solid transparent',
                                padding: '5px 0',
                                borderRadius: 0,
                                fontWeight: 'bold',
                                textDecoration: 'none',
                                background: 'transparent',
                                fontSize: '1rem',
                                cursor: 'pointer'
                            }}
                        >
                            SERIES
                        </button>
                    </div>

                    <form onSubmit={handleSearch} style={{ flex: 1, maxWidth: '800px', display: 'flex', alignItems: 'center' }}>
                        <span style={{ color: 'var(--primary)', marginRight: '10px' }}>&gt;</span>
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={`type to search...`}
                            style={{
                                width: '100%',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-main)',
                                fontSize: '1.2rem',
                                outline: 'none',
                                fontFamily: 'monospace'
                            }}
                            autoFocus
                        />
                    </form>
                </div>
            )}

            {/* Content Grid */}
            {!selectedItem && (
                <div className="discover-grid">
                    {!loading && results.length === 0 && !query && (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '100px 0', opacity: 0.5 }}>
                            <h3 style={{ fontWeight: 400 }}>waiting for input...</h3>
                        </div>
                    )}

                    {results.map(item => (
                        <div
                            className="movie-card"
                            key={item.imdb_id}
                            onClick={() => handleSelect(item)}
                        >
                            <img
                                src={item.poster}
                                alt={item.name}
                                onError={(e) => { e.target.src = 'https://via.placeholder.com/300x450?text=No+Poster'; }}
                            />
                            <div className="movie-card-h4-container">
                                <h4>{item.name}</h4>
                                <span>{item.year}</span>
                            </div>
                        </div>
                    ))}

                    {loading && (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--primary)' }}>
                            loading...
                        </div>
                    )}
                </div>
            )}

            {/* Netflix-Style Details View */}
            {selectedItem && (
                <div className="details-container animate-fade-in">
                    <div className="details-content">

                        {/* Hero Header */}
                        <div className="details-header">
                            <button
                                onClick={() => setSelectedItem(null)}
                                style={{
                                    alignSelf: 'flex-start',
                                    color: 'var(--text-muted)',
                                    textDecoration: 'none',
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    fontSize: '0.9rem',
                                    padding: 0,
                                    marginBottom: '10px'
                                }}
                            >
                                &larr; back
                            </button>

                            <h1 className="details-title">{selectedItem.name}</h1>

                            <div className="details-meta">
                                <span style={{ color: 'var(--primary)' }}>{selectedItem.year}</span>
                                {selectedItem.runtime && <span style={{ borderLeft: '1px solid #444', paddingLeft: '10px' }}>{selectedItem.runtime}</span>}
                                {selectedItem.genre && <span style={{ borderLeft: '1px solid #444', paddingLeft: '10px' }}>{Array.isArray(selectedItem.genre) ? selectedItem.genre.join(', ') : selectedItem.genre}</span>}
                            </div>
                        </div>

                        {/* Info Row: Poster + Description */}
                        <div className="details-info-row">
                            <img
                                src={selectedItem.poster}
                                alt={selectedItem.name}
                                className="details-poster"
                                onError={(e) => { e.target.src = 'https://via.placeholder.com/300x450?text=No+Poster'; }}
                            />
                            <p className="details-desc">{selectedItem.description}</p>
                        </div>

                        {/* Seasons Section */}
                        {selectedItem.type === 'series' && seasons.length > 0 && (
                            <div className="season-section">
                                <h3 className="section-header">Seasons</h3>
                                <div className="season-selector">
                                    {seasons.map(season => (
                                        <button
                                            key={season}
                                            onClick={() => handleSeasonSelect(season)}
                                            className={`season-btn ${selectedSeason === season ? 'active' : ''}`}
                                        >
                                            Season {season}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Episodes Section */}
                        {selectedItem.type === 'series' && selectedSeason && (
                            <div className="episode-section">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                    <h3 className="section-header">Episodes</h3>
                                    {selectedEpisode && (
                                        <button onClick={backToSeries} style={{ color: 'var(--primary)', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.85rem' }}>
                                            clear selection
                                        </button>
                                    )}
                                </div>
                                <div className="episode-grid">
                                    {episodes.map(ep => (
                                        <div
                                            key={ep.id}
                                            onClick={() => handleEpisodeSelect(ep)}
                                            className="episode-card"
                                            style={{
                                                borderColor: selectedEpisode?.id === ep.id ? 'var(--primary)' : undefined,
                                                color: selectedEpisode?.id === ep.id ? 'var(--primary)' : undefined
                                            }}
                                        >
                                            <div className="episode-number">S{selectedSeason}E{ep.episode}</div>
                                            <div className="episode-title">{ep.name || ep.title || 'Untitled'}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Streams Section */}
                        {(selectedItem.type === 'movie' || selectedEpisode) && (
                            <div className="stream-section">
                                <h3 className="section-header">
                                    Available Streams {selectedEpisode ? `(S${selectedSeason}E${selectedEpisode.episode})` : ''}
                                </h3>

                                {loadingStreams ? (
                                    <div style={{ padding: '20px 0', color: 'var(--primary)' }}>fetching sources...</div>
                                ) : (
                                    <div className="stream-list">
                                        {streams.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No streams found.</p>}
                                        {streams.map((stream, idx) => (
                                            <div
                                                key={idx}
                                                onClick={() => handleStreamClick(stream)}
                                                className="stream-item"
                                            >
                                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                                    <span style={{ fontWeight: '600', color: 'inherit', fontSize: '0.95rem' }}>
                                                        {stream.title?.split('\n')[0] || stream.name}
                                                    </span>
                                                    <span style={{ fontSize: '0.75rem', color: '#666', marginTop: '4px' }}>
                                                        {stream.title?.split('\n')[1] || ''}
                                                    </span>
                                                </div>
                                                <div style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '0.85rem' }}>
                                                    PLAY
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Placeholder hint */}
                        {selectedItem.type === 'series' && selectedSeason && !selectedEpisode && (
                            <div style={{ padding: '40px', textAlign: 'center', border: '1px dashed #333', borderRadius: '4px', color: 'var(--text-muted)' }}>
                                select an episode to see streams
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Stream Preparation Overlay */}
            {preparingStream && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(50, 52, 55, 0.95)',
                    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                    zIndex: 2000
                }}>
                    <div style={{
                        width: '50px', height: '50px',
                        border: '4px solid var(--bg-dark)',
                        borderTop: '4px solid var(--primary)',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }} />
                    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                    <h3 style={{ marginTop: '20px', color: 'var(--primary)', fontSize: '1.5rem', fontWeight: '400', fontFamily: 'monospace' }}>preparing_stream...</h3>
                    <p style={{ marginTop: '10px', color: 'var(--text-main)', fontFamily: 'monospace' }}>{streamStatus}</p>
                </div>
            )}
        </div>
    );
};

export default TorrentSearch;
