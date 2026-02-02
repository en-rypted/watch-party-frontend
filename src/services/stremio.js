
const CINEMETA_URL = 'https://v3-cinemeta.strem.io';
const TORRENTIO_URL = 'https://torrentio.strem.fun';

export const searchContent = async (query, type = 'movie') => {
    try {
        const response = await fetch(`${CINEMETA_URL}/catalog/${type}/top/search=${encodeURIComponent(query)}.json`);
        const data = await response.json();
        return data.metas || [];
    } catch (error) {
        console.error('Error searching content:', error);
        return [];
    }
};

export const getMeta = async (id, type) => {
    try {
        const response = await fetch(`${CINEMETA_URL}/meta/${type}/${id}.json`);
        const data = await response.json();
        return data.meta;
    } catch (error) {
        console.error('Error fetching metadata:', error);
        return null;
    }
};

export const getStreams = async (id, type) => {
    try {
        const response = await fetch(`${TORRENTIO_URL}/stream/${type}/${id}.json`);
        const data = await response.json();
        return data.streams || [];
    } catch (error) {
        console.error('Error fetching streams:', error);
        return [];
    }
};
