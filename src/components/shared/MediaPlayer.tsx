import React from 'react';
import ReactPlayer from 'react-player';

interface MediaPlayerProps {
    url: string;
    className?: string;
    onClick?: (e: React.MouseEvent) => void;
}

export const MediaPlayer: React.FC<MediaPlayerProps> = ({ url, className = '', onClick }) => {
    // Platform detection
    let label = '';
    if (/youtube\.com|youtu\.be/.test(url)) label = 'YouTube';
    else if (/soundcloud\.com/.test(url)) label = 'SoundCloud';
    else if (/vimeo\.com/.test(url)) label = 'Vimeo';
    else if (/twitch\.tv/.test(url)) label = 'Twitch';
    else if (/facebook\.com/.test(url)) label = 'Facebook';
    else if (url.match(/\.(mp4|webm)$/i)) label = 'Video';
    else if (url.match(/\.(mp3|wav|ogg)$/i)) label = 'Audio';
    return (
        <div className={className} onClick={onClick} style={{ position: 'relative' }}>
            <ReactPlayer
                url={url}
                controls
                width="100%"
                height={label === 'Audio' ? '50px' : '360px'}
                style={{ borderRadius: '0.75rem', overflow: 'hidden', background: '#000' }}
                config={{
                    file: {
                        attributes: {
                            controlsList: 'nodownload',
                            style: { maxHeight: '24rem', width: '100%' },
                        },
                    },
                }}
            />
            {label && (
                <span
                    className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded shadow"
                    style={{ pointerEvents: 'none', zIndex: 2 }}
                    aria-label={label + ' media'}
                >
                    {label}
                </span>
            )}
        </div>
    );
};
