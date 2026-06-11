import { useEffect, useRef, useState, useCallback } from 'react'
import type { FeedItem, VideoPlaybackInfo, VideoQuality, VideoInteractionState } from '../../../shared/types'
import { isRateLimitError, formatRateLimitError } from '../utils/rateLimit'
import { FavoriteModal } from './FavoriteModal'
import { CoinModal } from './CoinModal'
import { BiliVideoSidePanel } from './BiliVideoSidePanel'

interface VideoPlayerModalProps {
  item: FeedItem
  onClose: () => void
  onFavoriteFoldersChanged?: () => void
}

type PlayerState = 'loading' | 'ready' | 'playing' | 'error' | 'quality-loading'

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function VideoPlayerModal({ item, onClose, onFavoriteFoldersChanged }: VideoPlayerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const dashRef = useRef<any>(null)
  const playbackRef = useRef<VideoPlaybackInfo | null>(null)
  const interactionReqTimeRef = useRef(0)
  const playerRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const seekingRef = useRef(false)
  const volumeHideTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const dashErrorTimeRef = useRef(0)

  const [playerState, setPlayerState] = useState<PlayerState>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [qualities, setQualities] = useState<VideoQuality[]>([])
  const [currentQn, setCurrentQn] = useState(0)
  const [title, setTitle] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)
  const [showQualityMenu, setShowQualityMenu] = useState(false)
  const [showVolumeSlider, setShowVolumeSlider] = useState(false)
  const [interaction, setInteraction] = useState<VideoInteractionState | null>(null)
const [showCoinModal, setShowCoinModal] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [interactionError, setInteractionError] = useState('')
  const [showFavoriteModal, setShowFavoriteModal] = useState(false)

  const isLoading = playerState === 'loading' || playerState === 'quality-loading'

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current
    if (video && !seekingRef.current) {
      setCurrentTime(video.currentTime)
    }
  }, [])

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current
    if (video) setDuration(video.duration)
  }, [])

  const handleProgress = useCallback(() => {
    const video = videoRef.current
    if (video && video.buffered.length > 0) {
      const end = video.buffered.end(video.buffered.length - 1)
      setBuffered(video.duration > 0 ? end / video.duration : 0)
    }
  }, [])

  const handlePlayEvent = useCallback(() => setIsPlaying(true), [])
  const handlePauseEvent = useCallback(() => setIsPlaying(false), [])

  let isPlayingRef = useRef(false)
  isPlayingRef.current = isPlaying

  const startHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    if (isPlayingRef.current && !showSpeedMenu && !showQualityMenu && !showVolumeSlider) {
      hideTimerRef.current = setTimeout(() => {
        setControlsVisible(false)
      }, 3000)
    }
  }, [showSpeedMenu, showQualityMenu, showVolumeSlider])

  const openVolumeSlider = useCallback(() => {
    if (volumeHideTimerRef.current) clearTimeout(volumeHideTimerRef.current)
    setShowVolumeSlider(true)
  }, [])

  const scheduleCloseVolumeSlider = useCallback(() => {
    if (volumeHideTimerRef.current) clearTimeout(volumeHideTimerRef.current)
    volumeHideTimerRef.current = setTimeout(() => {
      setShowVolumeSlider(false)
    }, 300)
  }, [])

  const cancelCloseVolumeSlider = useCallback(() => {
    if (volumeHideTimerRef.current) clearTimeout(volumeHideTimerRef.current)
  }, [])

  const handleMouseMove = useCallback(() => {
    setControlsVisible(true)
    startHideTimer()
  }, [startHideTimer])

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play()
    } else {
      video.pause()
    }
  }, [])

  const handleProgressDragStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    seekingRef.current = true

    const rect = progressRef.current?.getBoundingClientRect()
    const video = videoRef.current
    if (rect && video && video.duration > 0) {
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      video.currentTime = x * video.duration
      setCurrentTime(video.currentTime)
    }

    const onMove = (ev: MouseEvent): void => {
      const r = progressRef.current?.getBoundingClientRect()
      const v = videoRef.current
      if (!r || !v || v.duration <= 0) return
      const x = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width))
      v.currentTime = x * v.duration
      setCurrentTime(v.currentTime)
    }

    const onUp = (): void => {
      seekingRef.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    setVolume(v)
    const video = videoRef.current
    if (video) {
      video.volume = v
      if (v === 0) {
        video.muted = true
        setIsMuted(true)
      } else {
        video.muted = false
        setIsMuted(false)
      }
    }
  }, [])

  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
  }, [])

  const handleRateChange = useCallback((rate: number) => {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = rate
    setPlaybackRate(rate)
    setShowSpeedMenu(false)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!playerRef.current) return
    if (!document.fullscreenElement) {
      playerRef.current.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }, [])

  useEffect(() => {
    const handler = (): void => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const initDash = useCallback(async (manifestUrl: string, seekTo?: number): Promise<void> => {
    const video = videoRef.current
    if (!video) return

    try {
      const dashModule = await import('dashjs')
      if (dashRef.current) {
        dashRef.current.reset()
      }

      const player = dashModule.MediaPlayer().create()
      dashRef.current = player

      player.updateSettings({
        debug: {
          logLevel: 0
        },
        streaming: {
          buffer: {
            bufferTimeDefault: 30,
            bufferTimeAtTopQuality: 10,
            bufferToKeep: 20,
            bufferPruningInterval: 30
          }
        }
      })

      return new Promise<void>((resolve) => {
        let resolved = false

        player.on('canPlay', () => {
          setPlayerState('ready')
          if (seekTo !== undefined) {
            video.currentTime = seekTo
          }
          if (!resolved) {
            resolved = true
            resolve()
          }
        })

        player.on('playing', () => {
          setPlayerState('playing')
        })

        player.on('error', (e: any) => {
          const now = Date.now()
          if (now - dashErrorTimeRef.current > 5000) {
            dashErrorTimeRef.current = now
            const errDetail = typeof e === 'object' && e !== null
              ? JSON.stringify({ event: e.event, error: e.error })
              : String(e)
            console.warn('[dashjs] error:', errDetail)
          }
          if (!resolved) {
            resolved = true
            if (video.readyState < 2) {
              setErrorMessage('播放出错，请尝试刷新或使用浏览器打开')
              setPlayerState('error')
            }
            resolve()
          }
        })

        player.initialize(video, manifestUrl, true)
      })
    } catch (err) {
      console.warn('[dashjs] init failed:', err)
      setErrorMessage('播放器初始化失败')
      setPlayerState('error')
    }
  }, [])

  const loadPlayback = useCallback(async (bvid: string, qn?: number) => {
    setPlayerState(qn ? 'quality-loading' : 'loading')
    try {
      const info = await window.electronApi.getVideoPlayback(bvid, qn)
      playbackRef.current = info

      if (!info.playable) {
        setErrorMessage(info.error || '无法播放此视频')
        setPlayerState('error')
        return
      }

      setTitle(info.title)
      setQualities(info.qualities)
      setCurrentQn(info.defaultQuality)

      await initDash(info.manifestUrl)
    } catch (err) {
      const { isLimited } = isRateLimitError(err)
      if (isLimited) {
        setErrorMessage(formatRateLimitError(err))
      } else {
        setErrorMessage('播放加载失败')
      }
      setPlayerState('error')
    }
  }, [initDash])

  const loadInteraction = useCallback(async (bvid: string, aid?: string) => {
    const reqTime = Date.now()
    interactionReqTimeRef.current = reqTime
    try {
      const state = await window.electronApi.getVideoInteraction(bvid, aid)
      if (reqTime >= interactionReqTimeRef.current) {
        setInteraction(state)
      }
    } catch {
      // Interaction state is non-critical, fail silently
    }
  }, [])

  const handleToggleLike = useCallback(async () => {
    if (!playbackRef.current || !interaction) return
    setInteractionError('')
    const bvid = playbackRef.current.bvid
    const newLiked = !interaction.liked
    const prevLiked = interaction.liked
    const prevStats = interaction.stats
    interactionReqTimeRef.current = Date.now()
    setInteraction(prev => prev ? { ...prev, liked: newLiked, stats: { ...prev.stats, like: prev.stats.like !== undefined ? prev.stats.like + (newLiked ? 1 : -1) : undefined } } : prev)
    try {
      const result = await window.electronApi.toggleVideoLike(bvid, newLiked)
      if (!result.success) {
        setInteraction(prev => prev ? { ...prev, liked: prevLiked, stats: prevStats } : prev)
        setInteractionError(result.error || '点赞失败')
        return
      }
      setInteractionError('')
      setTimeout(() => {
        if (bvid) loadInteraction(bvid, playbackRef.current?.aid)
      }, 2000)
    } catch {
      setInteraction(prev => prev ? { ...prev, liked: prevLiked, stats: prevStats } : prev)
      setInteractionError('点赞请求异常')
    }
  }, [interaction, loadInteraction])

const handleCoinSuccess = useCallback(() => {
    if (!playbackRef.current) return
    setInteractionError('')
    const bvid = playbackRef.current.bvid
    interactionReqTimeRef.current = Date.now()
    setInteraction(prev => prev ? { ...prev, coined: true } : prev)
    setTimeout(() => {
      if (bvid) loadInteraction(bvid, playbackRef.current?.aid)
    }, 2000)
  }, [loadInteraction])

  const handleToggleFavorite = useCallback(() => {
    if (!playbackRef.current || !interaction) return
    const aid = playbackRef.current.aid || item.aid
    if (!aid) return
    setInteractionError('')
    setShowFavoriteModal(true)
  }, [interaction, item.aid])

  const handleFavoriteSuccess = useCallback((bvid?: string, aid?: string) => {
    setInteractionError('')
    if (bvid) loadInteraction(bvid, aid)
  }, [loadInteraction])

  const handleVideoError = useCallback(() => {
    const video = videoRef.current
    if (video?.error) {
      console.warn('[video] native error:', video.error.code, video.error.message)
      setErrorMessage(video.error.message ? `播放错误: ${video.error.message}` : '播放出错')
      setPlayerState('error')
    }
  }, [])

  const handleShareLink = useCallback(async () => {
    const url = playbackRef.current?.externalUrl || item.url
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = url
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }, [item.url])

  function extractTokenFromUrl(manifestUrl: string): string | undefined {
    const match = manifestUrl.match(/\/mpd\/([a-f0-9]+)/)
    return match?.[1] || undefined
  }

  const handleQualityChange = useCallback(async (qn: number) => {
    if (isLoading || qn === currentQn || !playbackRef.current) return

    const video = videoRef.current
    if (!video) return

    const savedTime = video.currentTime
    const wasPlaying = !video.paused

    setPlayerState('quality-loading')
    try {
      const bvid = item.bvid || item.aid || playbackRef.current.bvid
      const cid = playbackRef.current.cid
      const token = extractTokenFromUrl(playbackRef.current.manifestUrl)
      if (!bvid || !cid) {
        setErrorMessage('无法识别视频 ID')
        setPlayerState('error')
        return
      }
      const result = await window.electronApi.changeVideoQuality(bvid, cid, qn, token)

      if (result.manifestUrl && dashRef.current) {
        setCurrentQn(qn)

        const player = dashRef.current
        const onCanPlay = () => {
          try {
            video.currentTime = savedTime
            if (wasPlaying && video.paused) {
              video.play()
            }
          } catch {}
          setPlayerState('ready')
          player.off('canPlay', onCanPlay)
        }
        player.on('canPlay', onCanPlay)
        player.attachSource(result.manifestUrl + '?r=' + Date.now())
      } else {
        setErrorMessage(result.error || '切换清晰度失败')
        setPlayerState('error')
      }
    } catch (err) {
      const { isLimited } = isRateLimitError(err)
      setErrorMessage(isLimited ? formatRateLimitError(err) : '切换清晰度失败')
      setPlayerState('error')
    }
    setShowQualityMenu(false)
  }, [isLoading, currentQn, item.bvid, item.aid])

  const handleOpenExternal = useCallback(() => {
    const url = playbackRef.current?.externalUrl || item.url
    window.open(url, '_blank')
  }, [item.url])

  const handleRetry = useCallback(() => {
    const bvid = item.bvid || item.aid
    if (bvid) {
      setErrorMessage('')
      loadPlayback(bvid, currentQn || undefined)
    }
  }, [item.bvid, item.aid, currentQn, loadPlayback])

  useEffect(() => {
    const bvid = item.bvid || item.aid
    if (bvid) {
      loadPlayback(bvid)
    } else {
      setErrorMessage('无法识别视频 ID')
      setPlayerState('error')
    }

    return () => {
      if (dashRef.current) {
        dashRef.current.reset()
        dashRef.current = null
      }
    }
  }, [item, loadPlayback])

  useEffect(() => {
    if (playbackRef.current && (playerState === 'ready' || playerState === 'playing')) {
      const bvid = playbackRef.current.bvid
      if (bvid) loadInteraction(bvid, playbackRef.current.aid)
    }
  }, [playerState, loadInteraction])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.code) {
        case 'Space':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowLeft':
          e.preventDefault()
          if (videoRef.current) videoRef.current.currentTime -= 5
          break
        case 'ArrowRight':
          e.preventDefault()
          if (videoRef.current) videoRef.current.currentTime += 5
          break
        case 'ArrowUp': {
          e.preventDefault()
          const video = videoRef.current
          if (video) {
            const v = Math.min(1, video.volume + 0.1)
            video.volume = v
            setVolume(v)
            if (v > 0) {
              video.muted = false
              setIsMuted(false)
            }
          }
          break
        }
        case 'ArrowDown': {
          e.preventDefault()
          const video = videoRef.current
          if (video) {
            const v = Math.max(0, video.volume - 0.1)
            video.volume = v
            setVolume(v)
            if (v === 0) {
              video.muted = true
              setIsMuted(true)
            }
          }
          break
        }
        case 'KeyF':
          e.preventDefault()
          toggleFullscreen()
          break
        case 'KeyM':
          e.preventDefault()
          toggleMute()
          break
        case 'Escape':
          if (document.fullscreenElement) {
            document.exitFullscreen()
          } else {
            onClose()
          }
          break
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [togglePlay, toggleFullscreen, toggleMute, onClose])

  useEffect(() => {
    startHideTimer()
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [isPlaying, startHideTimer])

  useEffect(() => {
    return () => {
      if (volumeHideTimerRef.current) clearTimeout(volumeHideTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const handler = (): void => {
      setShowSpeedMenu(false)
      setShowQualityMenu(false)
      setShowVolumeSlider(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  useEffect(() => {
    if (interactionError) {
      const t = setTimeout(() => setInteractionError(''), 3000)
      return () => clearTimeout(t)
    }
  }, [interactionError])

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0
  const bufferedPercent = buffered * 100

  const currentQualityLabel = qualities.find(q => q.qn === currentQn)?.description || '画质'

  return (
    <div       className="fixed inset-0 z-50 bg-slate-100/70 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div
        ref={playerRef}
        className="flex flex-col lg:flex-row bg-white rounded-2xl overflow-hidden w-[96vw] max-w-[1440px] max-h-[92vh] shadow-xl border border-gray-100/50 select-none"
        onClick={(e) => e.stopPropagation()}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { if (isPlaying) setControlsVisible(false) }}
      >
        {/* Left: Player + Footer */}
        <div className="flex-1 min-w-0 flex flex-col bg-black relative min-h-0">
          {/* Top bar */}
          <div
            className={`absolute top-0 left-0 right-0 z-20 px-5 py-3 bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-300 ${
              controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-white/90 truncate pr-4">{title || '视频播放'}</h3>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors shrink-0"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Video area */}
          <div className="relative bg-black w-full flex-1 min-h-0">
            <video
              ref={videoRef}
              className="w-full h-full outline-none cursor-pointer object-contain"
              playsInline
              onClick={togglePlay}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onProgress={handleProgress}
              onPlay={handlePlayEvent}
              onPause={handlePauseEvent}
              onEnded={() => setIsPlaying(false)}
              onError={handleVideoError}
              preload="metadata"
            />

            {playerState === 'loading' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
                <div className="flex items-center gap-2 text-white/60 text-sm">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  加载中...
                </div>
              </div>
            )}
            {playerState === 'quality-loading' && (
              <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 text-white/70 text-xs">
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                切换清晰度
              </div>
            )}

            {!isPlaying && !isLoading && playerState !== 'error' && (
              <div
                className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer"
                onClick={togglePlay}
              >
                <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            )}

            {playerState === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-10 gap-4">
                <div className="text-center">
                  <p className="text-white/80 text-sm mb-1">{errorMessage}</p>
                  <p className="text-white/40 text-xs">视频可能受版权保护或需要大会员</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleRetry}
                    className="px-4 py-2 text-sm rounded-lg bg-white/15 text-white hover:bg-white/25 transition-colors"
                  >
                    重试
                  </button>
                  <button
                    onClick={handleOpenExternal}
                    className="px-4 py-2 text-sm rounded-lg bg-[#00A1D6] text-white hover:bg-[#00B5E5] transition-colors"
                  >
                    在 B站 打开
                  </button>
                </div>
              </div>
            )}

            {/* Bottom controls */}
            <div
              className={`absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-12 pb-3 px-4 transition-opacity duration-300 ${
                controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              {/* Progress bar */}
              <div
                ref={progressRef}
                className="relative h-1 mb-3 bg-white/20 rounded-full cursor-pointer group/progress"
                onMouseDown={handleProgressDragStart}
              >
                <div
                  className="absolute top-0 left-0 h-full bg-white/30 rounded-full transition-[width] duration-100"
                  style={{ width: `${bufferedPercent}%` }}
                />
                <div
                  className="absolute top-0 left-0 h-full bg-[#00A1D6] rounded-full transition-[width] duration-100"
                  style={{ width: `${progressPercent}%` }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover/progress:opacity-100 transition-opacity"
                  style={{ left: `calc(${progressPercent}% - 6px)` }}
                />
              </div>

              {/* Controls row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={togglePlay} className="text-white/80 hover:text-white transition-colors">
                    {isPlaying ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>

                  <span className="text-white/60 text-xs tabular-nums">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>

                  {/* Volume */}
                  <div
                    className="relative flex items-center"
                    onMouseEnter={openVolumeSlider}
                    onMouseLeave={scheduleCloseVolumeSlider}
                  >
                    <button onClick={toggleMute} className="text-white/80 hover:text-white transition-colors p-1">
                      {isMuted || volume === 0 ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                          <line x1="23" y1="9" x2="17" y2="15" />
                          <line x1="17" y1="9" x2="23" y2="15" />
                        </svg>
                      ) : volume < 0.5 ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                          <path d="M15.54 8.46a5 5 0 010 7.07" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                          <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
                        </svg>
                      )}
                    </button>
                    {showVolumeSlider && (
                      <div
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white rounded-lg p-3 shadow-lg border border-gray-100"
                        onClick={(e) => e.stopPropagation()}
                        onMouseEnter={cancelCloseVolumeSlider}
                        onMouseLeave={scheduleCloseVolumeSlider}
                      >
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={isMuted ? 0 : volume}
                          onChange={handleVolumeChange}
                          className="w-28 h-2 accent-[#00A1D6] cursor-pointer"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {/* Playback speed */}
                  <div className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowSpeedMenu(prev => !prev); setShowQualityMenu(false) }}
                      className="text-white/70 hover:text-white transition-colors text-xs px-1.5 py-0.5 rounded hover:bg-white/10"
                    >
                      {playbackRate}x
                    </button>
                    {showSpeedMenu && (
                      <div
                        className="absolute bottom-full right-0 mb-2 bg-white rounded-lg py-1 shadow-lg border border-gray-100 min-w-[80px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {PLAYBACK_RATES.map(rate => (
                          <button
                            key={rate}
                            onClick={() => handleRateChange(rate)}
                            className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors ${
                              rate === playbackRate ? 'text-[#00A1D6]' : 'text-gray-700'
                            }`}
                          >
                            {rate}x
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quality */}
                  {qualities.length > 1 && (
                    <div className="relative">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowQualityMenu(prev => !prev); setShowSpeedMenu(false) }}
                        disabled={isLoading}
                        className="text-white/70 hover:text-white transition-colors text-xs px-1.5 py-0.5 rounded hover:bg-white/10 disabled:opacity-50"
                      >
                        {currentQualityLabel}
                      </button>
                      {showQualityMenu && (
                        <div
                        className="absolute bottom-full right-0 mb-2 bg-white rounded-lg py-1 shadow-lg border border-gray-100 min-w-[100px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {qualities.map(q => (
                          <button
                            key={q.qn}
                            onClick={() => handleQualityChange(q.qn)}
                            disabled={isLoading}
                            className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors disabled:opacity-40 ${
                              q.qn === currentQn ? 'text-[#00A1D6]' : 'text-gray-700'
                            }`}
                            >
                              {q.description}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Fullscreen */}
                  <button
                    onClick={toggleFullscreen}
                    className="text-white/80 hover:text-white transition-colors p-1"
                  >
                    {isFullscreen ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-white border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-gray-400 min-w-0">
                <span className="truncate">{item.author}</span>
                {item.platform === 'bilibili' && (
                  <span className="shrink-0 px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 text-[10px]">Bili</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleToggleLike}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
                    interaction?.liked
                      ? 'text-[#00A1D6] bg-[#00A1D6]/10'
                      : 'text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100'
                  }`}
                  title={interaction?.liked ? '取消点赞' : '点赞'}
                >
                  <span className="text-base leading-none">👍</span>
                  {interaction?.stats?.like != null && <span className="text-xs font-medium tabular-nums">{interaction.stats.like}</span>}
                </button>
                <div>
                  <button
                    onClick={() => { if (!interaction?.coined) setShowCoinModal(true) }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
                      interaction?.coined
                        ? 'text-[#00A1D6] bg-[#00A1D6]/10'
                        : 'text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100'
                    }`}
                    title={interaction?.coined ? '已投币' : '投币'}
                  >
                    <span className="text-base leading-none">🪙</span>
                    {interaction?.stats?.coin != null && <span className="text-xs font-medium tabular-nums">{interaction.stats.coin}</span>}
                  </button>
                </div>
                <button
                  onClick={handleToggleFavorite}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
                    interaction?.favorited
                      ? 'text-[#00A1D6] bg-[#00A1D6]/10'
                      : 'text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100'
                  }`}
                  title={interaction?.favorited ? '取消收藏' : '收藏'}
                >
                  <span className="text-base leading-none">⭐</span>
                  {interaction?.stats?.favorite != null && <span className="text-xs font-medium tabular-nums">{interaction.stats.favorite}</span>}
                </button>
                <button
                  onClick={handleShareLink}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors"
                  title="复制B站链接"
                >
                  <span className="text-base leading-none">🔗</span>
                </button>
              </div>
              <button
                onClick={handleOpenExternal}
                className="shrink-0 text-xs text-[#00A1D6] hover:text-[#00B5E5] transition-colors"
              >
                在B站打开
              </button>
            </div>
            {shareCopied && (
              <div className="text-[10px] text-[#00A1D6] text-right mt-1">链接已复制到剪贴板</div>
            )}
            {interactionError && (
              <div className="text-[10px] text-red-400 text-right mt-1">{interactionError}</div>
            )}
          </div>
        </div>

        {/* Right: BiliVideoSidePanel */}
        {playbackRef.current && (
          <BiliVideoSidePanel
            bvid={playbackRef.current.bvid}
            aid={playbackRef.current.aid}
          />
        )}
      </div>
      {showCoinModal && playbackRef.current && (
        <CoinModal
          bvid={playbackRef.current.bvid}
          aid={playbackRef.current.aid}
          onClose={() => setShowCoinModal(false)}
          onSuccess={handleCoinSuccess}
        />
      )}
      {showFavoriteModal && playbackRef.current && (
        <FavoriteModal
          aid={playbackRef.current.aid || item.aid || ''}
          bvid={playbackRef.current.bvid}
          onClose={() => setShowFavoriteModal(false)}
          onSuccess={handleFavoriteSuccess}
          onFoldersChanged={onFavoriteFoldersChanged}
        />
      )}
    </div>
  )
}
