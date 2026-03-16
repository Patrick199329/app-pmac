import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, checkVideoWatched } from '../services/supabase';
import { PlayCircle, CheckCircle, ArrowRight, Loader2, AlertCircle, ShieldCheck, RefreshCw, ExternalLink } from 'lucide-react';
import LoadingOverlay from '../components/LoadingOverlay';

const VideoPlayer = () => {
  const { key } = useParams();
  const navigate = useNavigate();
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [canContinue, setCanContinue] = useState(false);
  const [userId, setUserId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const getTitle = () => {
    switch (key) {
      case 'intro_1': return 'Vídeo Obrigatório: Introdução';
      case 'intro_2': return 'Vídeo Final';
      default: return 'Vídeo de Instrução';
    }
  };

  const isYouTube = (url) => {
    return url.includes('youtube.com') || url.includes('youtu.be');
  };

  // Tracking for direct video anti-skip
  const videoRef = React.useRef(null);
  const [farthestTimeLocal, setFarthestTimeLocal] = useState(0);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.currentTime > farthestTimeLocal + 2) {
      video.currentTime = farthestTimeLocal;
    } else {
      setFarthestTimeLocal(Math.max(farthestTimeLocal, video.currentTime));
    }

    // Auto-complete if they reach the end correctly
    if (video.currentTime >= video.duration - 2 && !completed) {
      handleEnded();
    }
  };

  // YouTube IFrame API Handler
  useEffect(() => {
    if (!videoUrl || !isYouTube(videoUrl)) return;

    const videoId = videoUrl.includes('v=')
      ? videoUrl.split('v=')[1].split('&')[0]
      : videoUrl.split('/').pop();

    let player;
    let checkInterval;
    let farthestTime = 0;

    const initPlayer = () => {
      setTimeout(() => {
        try {
          player = new window.YT.Player('youtube-player-iframe', {
            events: {
              'onStateChange': (event) => {
                if (event.data === window.YT.PlayerState.PLAYING) {
                  checkInterval = setInterval(() => {
                    const currentTime = player.getCurrentTime();
                    if (currentTime > farthestTime + 2) {
                      player.seekTo(farthestTime, true);
                    } else {
                      farthestTime = Math.max(farthestTime, currentTime);
                    }
                  }, 500);
                } else {
                  clearInterval(checkInterval);
                }

                if (event.data === window.YT.PlayerState.ENDED) {
                  const duration = player.getDuration();
                  if (farthestTime >= duration - 3) {
                    handleEnded();
                  } else {
                    player.seekTo(farthestTime, true);
                    player.playVideo();
                  }
                }
              },
              'onError': (e) => {
                console.error("YT API Error:", e);
              }
            }
          });
        } catch (e) {
          console.error("Failed to attach YT player API:", e);
        }
      }, 1000);
    };

    if (!window.YT || !window.YT.Player) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      window.onYouTubeIframeAPIReady = initPlayer;
    } else {
      initPlayer();
    }

    return () => {
      clearInterval(checkInterval);
    };
  }, [videoUrl]);

  useEffect(() => {
    const fetchVideoAndStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate('/login');
          return;
        }
        setUserId(user.id);

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        setIsAdmin(profile?.role === 'ADMIN');

        const { data: video } = await supabase.from('videos').select('url').eq('key', key).single();

        if (video?.url) {
          setVideoUrl(video.url.trim());
        } else {
          setVideoUrl('https://www.youtube.com/watch?v=gw1NSFYN_uI');
        }

        const watched = await checkVideoWatched(user.id, key);
        if (watched) {
          setCompleted(true);
          setCanContinue(true);
        }
      } catch (err) {
        console.error("Error fetching video status:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchVideoAndStatus();
  }, [key, navigate]);

  const handleEnded = async () => {
    if (completed) return;
    setCompleted(true);
    setCanContinue(true);

    const { error } = await supabase
      .from('video_views')
      .upsert({
        user_id: userId,
        video_key: key,
        completed_at: new Date().toISOString()
      }, { onConflict: 'user_id, video_key' });

    if (error) console.error('Error saving video view:', error);
  };

  const handleAdminBypass = () => {
    setCompleted(true);
    setCanContinue(true);
  };

  const handleContinue = () => {
    navigate('/basic/start');
  };

  if (loading) {
    return <LoadingOverlay message="Carregando Vídeo" subtitle="Preparando seu conteúdo obrigatório..." />;
  }

  const getVideoId = () => {
    if (!videoUrl) return '';
    return videoUrl.includes('v=')
      ? videoUrl.split('v=')[1].split('&')[0]
      : videoUrl.split('/').pop();
  };

  return (
    <div className="video-page-container fade-in">
      <div className="video-card glass-panel">
        <div className="video-header">
          <PlayCircle size={24} className="accent-text" />
          <div>
            <h2>{getTitle()}</h2>
            <p className="video-key-tag">Key: {key}</p>
          </div>
        </div>

        <p className="video-instruction">
          Assista ao vídeo informativo abaixo por completo para habilitar o início do seu teste.
        </p>

        <div className="player-wrapper" key={videoUrl}>
          {isYouTube(videoUrl) ? (
            <iframe
              id="youtube-player-iframe"
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${getVideoId()}?enablejsapi=1&rel=0&modestbranding=1`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          ) : videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              className="direct-video-player"
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleEnded}
              controls
              onContextMenu={(e) => e.preventDefault()}
              controlsList="nodownload"
            />
          ) : (
            <div className="player-loading">
              <Loader2 className="animate-spin" size={32} />
              <p>Carregando vídeo...</p>
            </div>
          )}
        </div>

        <div className="video-footer">
          <div className="left-side">
            {completed ? (
              <div className="status-badge success">
                <CheckCircle size={18} />
                <span>Vídeo Concluído</span>
              </div>
            ) : (
              <div className="status-badge busy">
                <AlertCircle size={18} />
                <span>Assista até o fim para avançar</span>
              </div>
            )}

            {isAdmin && !completed && (
              <button className="bypass-btn" onClick={handleAdminBypass}>
                <ShieldCheck size={16} />
                <span>Pular (Admin)</span>
              </button>
            )}
          </div>

          <button
            className={`primary-btn ${canContinue ? '' : 'disabled'}`}
            disabled={!canContinue}
            onClick={handleContinue}
          >
            <span>Continuar para o Questionário PMAC®</span>
            <ArrowRight size={20} />
          </button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .video-page-container {
          display: flex;
          justify-content: center;
          padding: 2rem 0;
        }

        .video-card {
          width: 100%;
          max-width: 900px;
          padding: 2rem;
        }

        .video-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .accent-text {
          color: var(--accent-primary);
        }

        .video-instruction {
          color: var(--text-secondary);
          margin-bottom: 2rem;
        }

        .player-wrapper {
          position: relative;
          padding-top: 56.25%; /* 16:9 Aspect Ratio */
          background: black;
          border-radius: 0.5rem;
          overflow: hidden;
          margin-bottom: 2rem;
          border: 1px solid var(--glass-border);
        }

        .player-wrapper iframe, .direct-video-player {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border: none;
        }

        .direct-video-player {
          background: black;
          object-fit: contain;
        }

        .player-error, .player-error-overlay, .player-loading {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgba(15, 23, 42, 0.9);
          color: var(--text-secondary);
          gap: 1rem;
          padding: 2rem;
          text-align: center;
          z-index: 10;
        }

        .player-error-overlay {
          background: rgba(15, 23, 42, 0.95);
          color: #fca5a5;
          border: 1px solid var(--accent-danger);
          border-radius: 0.5rem;
        }

        .video-key-tag {
          font-size: 0.75rem;
          color: var(--text-tertiary);
          font-family: monospace;
          background: rgba(255,255,255,0.05);
          padding: 2px 6px;
          border-radius: 4px;
          margin-top: 4px;
        }

        .player-error-overlay h3 {
          margin: 0.5rem 0;
          color: #fca5a5;
        }

        .error-icon {
          color: #ef4444;
        }

        .error-actions {
          display: flex;
          gap: 1rem;
          margin-top: 1rem;
        }

        .link-btn {
          padding: 0.75rem 1.25rem;
          background: #ff000020;
          color: #ff4444;
          border: 1px solid #ff000040;
          border-radius: 0.5rem;
          font-weight: 600;
          font-size: 0.875rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: var(--transition-smooth);
        }

        .link-btn:hover { background: #ff000040; }

        .secondary-btn.sm, .link-btn.sm {
          padding: 0.5rem 1rem;
          font-size: 0.75rem;
          border-radius: 0.4rem;
        }

        .video-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .left-side {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .bypass-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(139, 92, 246, 0.1);
          color: var(--accent-primary);
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          border: 1px solid rgba(139, 92, 246, 0.2);
          transition: var(--transition-smooth);
        }

        .bypass-btn:hover { background: var(--accent-primary); color: white; }

        .status-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border-radius: 2rem;
          font-size: 0.875rem;
          font-weight: 600;
        }

        .status-badge.success {
          background: rgba(16, 185, 129, 0.1);
          color: var(--accent-secondary);
        }

        .status-badge.busy {
          background: rgba(245, 158, 11, 0.1);
          color: var(--accent-warning);
        }

        .primary-btn.disabled {
          background: var(--bg-tertiary);
          color: var(--text-tertiary);
          cursor: not-allowed;
          opacity: 0.7;
        }

        @media (max-width: 600px) {
          .video-footer {
            flex-direction: column;
            align-items: stretch;
          }
          
          .status-badge {
            justify-content: center;
          }
        }
      `}} />
    </div>
  );
};

export default VideoPlayer;
