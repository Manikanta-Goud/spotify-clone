'use client';

import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, Search, Library, Plus, Heart,
  Play, Pause, SkipBack, SkipForward, Repeat,
  Shuffle, Volume2, Mic2, ListMusic, Maximize2,
  ChevronLeft, ChevronRight, Bell, User, Music2,
  MoreHorizontal, Clock
} from 'lucide-react';
import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Song {
  _id: string;
  title: string;
  uri: string;
  artist: { _id: string; username?: string; email?: string } | string;
}

interface Album {
  _id: string;
  title: string;
  artist: { _id: string; username?: string; email?: string } | string;
  musics: Song[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const API = 'http://localhost:5000/api';
const fmtTime = (s: number) => {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};
const artistName = (a: Song['artist']) =>
  typeof a === 'string' ? a : (a?.username ?? a?.email ?? 'Unknown Artist');

// Gradient palettes for album cards
const PALETTES = [
  'from-purple-900 to-sp-surface',
  'from-blue-900 to-sp-surface',
  'from-rose-900 to-sp-surface',
  'from-amber-900 to-sp-surface',
  'from-green-900 to-sp-surface',
  'from-cyan-900 to-sp-surface',
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function PlayingBars() {
  return (
    <div className="playing-bar flex items-end gap-[2px] h-4">
      <span className="w-[3px] rounded-sm bg-sp-green" />
      <span className="w-[3px] rounded-sm bg-sp-green" />
      <span className="w-[3px] rounded-sm bg-sp-green" />
    </div>
  );
}

function AlbumArt({ index, size = 56 }: { index: number; size?: number }) {
  const palette = PALETTES[index % PALETTES.length];
  return (
    <div
      className={`flex-shrink-0 rounded bg-gradient-to-br ${palette} flex items-center justify-center`}
      style={{ width: size, height: size }}
    >
      <Music2 className="text-white/30" style={{ width: size * 0.45, height: size * 0.45 }} />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SpotifyClone() {
  // Auth
  const [user, setUser] = useState<{ email: string; role: string; username: string; id: string } | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [loginForm, setLoginForm] = useState({ identifier: '', password: '' });
  const [signupForm, setSignupForm] = useState({ username: '', email: '', password: '', role: 'user' as 'user' | 'artist' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Data
  const [songs, setSongs] = useState<Song[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(false);

  // Playback
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // UI
  const [activeView, setActiveView] = useState<'home' | 'search' | 'album' | 'upload'>('home');
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  // Artist / Upload State
  const [uploadData, setUploadData] = useState({ title: '', file: null as File | null });
  const [albumData, setAlbumData] = useState({ title: '', selectedSongs: [] as string[] });
  const [uploadStatus, setUploadStatus] = useState({ loading: false, error: '', success: false });
  const [albumStatus, setAlbumStatus] = useState({ loading: false, error: '', success: false });

  // ── Auth ────────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const body = {
        username: loginForm.identifier,
        email: loginForm.identifier,
        password: loginForm.password
      };
      const res = await axios.post(`${API}/auth/login`, body, { withCredentials: true });
      const u = res.data?.user;
      setUser({
        email: u?.email ?? loginForm.identifier,
        role: u?.role ?? 'user',
        username: u?.username ?? '',
        id: u?.id || u?._id
      });
      fetchData();
    } catch (err: any) {
      setAuthError(err?.response?.data?.message ?? 'Invalid credentials. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await axios.post(`${API}/auth/register`, signupForm, { withCredentials: true });
      const u = res.data?.user;
      setUser({
        email: u?.email ?? signupForm.email,
        role: u?.role ?? signupForm.role,
        username: u?.username ?? signupForm.username,
        id: u?.id || u?._id
      });
      fetchData();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Registration failed. Check if backend is running.';
      setAuthError(msg);
      console.error('Signup Error:', err);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
    setUser(null);
    setSongs([]);
    setAlbums([]);
    setCurrentSong(null);
    setIsPlaying(false);
    setAuthMode('login');
  };

  // ── Data fetching ────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [songsRes, albumsRes] = await Promise.all([
        axios.get(`${API}/music/allsongs`, { withCredentials: true }),
        axios.get(`${API}/music/albums`, { withCredentials: true }),
      ]);
      setSongs(Array.isArray(songsRes.data?.musics) ? songsRes.data.musics : []);
      setAlbums(Array.isArray(albumsRes.data?.albums) ? albumsRes.data.albums : []);
    } catch {
      // silently fail — backend may be offline
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Playback controls ────────────────────────────────────────────────────────
  const playSong = (song: Song) => {
    setCurrentSong(song);
    setIsPlaying(true);
    setProgress(0);
  };

  const togglePlay = () => {
    if (!currentSong) return;
    if (isPlaying) {
      audioRef.current?.pause();
    } else {
      audioRef.current?.play();
    }
    setIsPlaying(!isPlaying);
  };

  const skipNext = () => {
    if (!songs.length || !currentSong) return;
    const idx = songs.findIndex(s => s._id === currentSong._id);
    const nextIdx = shuffle
      ? Math.floor(Math.random() * songs.length)
      : (idx + 1) % songs.length;
    playSong(songs[nextIdx]);
  };

  const skipPrev = () => {
    if (!songs.length || !currentSong) return;
    const idx = songs.findIndex(s => s._id === currentSong._id);
    const prevIdx = (idx - 1 + songs.length) % songs.length;
    playSong(songs[prevIdx]);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;
    audio.src = currentSong.uri;
    audio.volume = volume / 100;
    audio.play().catch(() => {});
    const onTime = () => setProgress(audio.currentTime);
    const onLoad = () => setDuration(audio.duration);
    const onEnd  = () => { if (repeat) { audio.currentTime = 0; audio.play(); } else skipNext(); };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onLoad);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onLoad);
      audio.removeEventListener('ended', onEnd);
    };
  }, [currentSong]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadData.file || !uploadData.title) return;
    setUploadStatus({ loading: true, error: '', success: false });

    const formData = new FormData();
    formData.append('title', uploadData.title);
    formData.append('music', uploadData.file);

    try {
      await axios.post(`${API}/music/upload`, formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadStatus({ loading: false, error: '', success: true });
      setUploadData({ title: '', file: null });
      fetchData(); // refresh library
    } catch (err: any) {
      setUploadStatus({ loading: false, error: err?.response?.data?.message || 'Upload failed.', success: false });
    }
  };

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!albumData.title || albumData.selectedSongs.length === 0) return;
    setAlbumStatus({ loading: true, error: '', success: false });

    try {
      await axios.post(`${API}/music/album`, {
        title: albumData.title,
        musics: albumData.selectedSongs
      }, { withCredentials: true });
      setAlbumStatus({ loading: false, error: '', success: true });
      setAlbumData({ title: '', selectedSongs: [] });
      fetchData();
    } catch (err: any) {
      setAlbumStatus({ loading: false, error: err?.response?.data?.message || 'Failed to create album.', success: false });
    }
  };

  const filteredSongs = songs.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    artistName(s.artist).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const mySongs = songs.filter(s => {
    const artistId = typeof s.artist === 'string' ? s.artist : s.artist._id;
    return artistId === (user as any)?.id;
  });

  // ─── Auth Screen (Login / Sign Up) ─────────────────────────────────────────
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sp-black px-4">
        <audio ref={audioRef} />

        <AnimatePresence mode="wait">
          {/* ── LOGIN ── */}
          {authMode === 'login' && (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35 }}
              className="w-full max-w-md rounded-2xl bg-sp-surface p-10 shadow-2xl"
            >
              {/* Logo */}
              <div className="mb-8 flex justify-center">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sp-green">
                    <Music2 className="h-7 w-7 text-black" />
                  </div>
                  <span className="text-2xl font-black tracking-tight">Spotify</span>
                </div>
              </div>

              <h2 className="mb-2 text-center text-2xl font-bold">Log in to Spotify</h2>
              <p className="mb-6 text-center text-sm text-sp-subtext">Welcome back!</p>

              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-sp-subtext">
                    Email or Username
                  </label>
                  <input
                    type="text"
                    required
                    value={loginForm.identifier}
                    onChange={e => setLoginForm(p => ({ ...p, identifier: e.target.value }))}
                    className="w-full rounded-md border border-sp-border bg-sp-elevated px-4 py-2.5 text-sm text-sp-text placeholder-sp-muted outline-none transition focus:border-white"
                    placeholder="Email or Username"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-sp-subtext">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={loginForm.password}
                    onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))}
                    className="w-full rounded-md border border-sp-border bg-sp-elevated px-4 py-2.5 text-sm text-sp-text placeholder-sp-muted outline-none transition focus:border-white"
                    placeholder="Password"
                  />
                </div>

                {authError && (
                  <p className="rounded-md bg-red-900/40 px-4 py-2 text-center text-sm text-red-400">
                    {authError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="mt-2 rounded-full bg-sp-green py-3 font-bold text-black transition hover:bg-sp-green-h active:scale-95 disabled:opacity-50"
                >
                  {authLoading ? 'Logging in…' : 'Log In'}
                </button>
              </form>

              <div className="mt-6 border-t border-sp-border pt-6 text-center text-sm text-sp-subtext">
                Don't have an account?{' '}
                <button
                  onClick={() => { setAuthMode('signup'); setAuthError(''); }}
                  className="font-bold text-white underline hover:text-sp-green transition"
                >
                  Sign up for Spotify
                </button>
              </div>
            </motion.div>
          )}

          {/* ── SIGN UP ── */}
          {authMode === 'signup' && (
            <motion.div
              key="signup"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-sm rounded-2xl bg-sp-surface p-6 shadow-2xl border border-white/5"
            >
              {/* Logo */}
              <div className="mb-4 flex justify-center">
                <div className="flex items-center gap-1.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sp-green">
                    <Music2 className="h-5 w-5 text-black" />
                  </div>
                  <span className="text-lg font-black tracking-tight">Spotify</span>
                </div>
              </div>

              <h2 className="mb-1 text-center text-lg font-bold">Create your account</h2>
              <p className="mb-4 text-center text-xs text-sp-subtext">
                Join millions of music fans
              </p>

              <form onSubmit={handleSignup} className="flex flex-col gap-4">
                {/* Username */}
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-sp-subtext">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={signupForm.username}
                    onChange={e => setSignupForm(p => ({ ...p, username: e.target.value }))}
                    className="w-full rounded-md border border-sp-border bg-sp-elevated px-4 py-2.5 text-sm text-sp-text placeholder-sp-muted outline-none transition focus:border-white"
                    placeholder="Pick a username"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-sp-subtext">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={signupForm.email}
                    onChange={e => setSignupForm(p => ({ ...p, email: e.target.value }))}
                    className="w-full rounded-md border border-sp-border bg-sp-elevated px-4 py-2.5 text-sm text-sp-text placeholder-sp-muted outline-none transition focus:border-white"
                    placeholder="Your email address"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-sp-subtext">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={signupForm.password}
                    onChange={e => setSignupForm(p => ({ ...p, password: e.target.value }))}
                    className="w-full rounded-md border border-sp-border bg-sp-elevated px-4 py-3 text-sm text-sp-text placeholder-sp-muted outline-none transition focus:border-white"
                    placeholder="Create a strong password"
                  />
                </div>

                {/* Role Selector */}
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-sp-subtext">
                    I am a…
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {/* User / Listener Card */}
                    <button
                      type="button"
                      onClick={() => setSignupForm(p => ({ ...p, role: 'user' }))}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition ${
                        signupForm.role === 'user'
                          ? 'border-sp-green bg-sp-green/10'
                          : 'border-sp-border bg-sp-elevated hover:border-sp-muted'
                      }`}
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        signupForm.role === 'user' ? 'bg-sp-green text-black' : 'bg-sp-border text-sp-subtext'
                      }`}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 1 1 18 0v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 15v-3a9 9 0 0 1 9-9v0a9 9 0 0 1 9 9v3" />
                        </svg>
                      </div>
                      <p className="font-bold text-xs">Listener</p>
                    </button>

                    {/* Artist Card */}
                    <button
                      type="button"
                      onClick={() => setSignupForm(p => ({ ...p, role: 'artist' }))}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition ${
                        signupForm.role === 'artist'
                          ? 'border-sp-green bg-sp-green/10'
                          : 'border-sp-border bg-sp-elevated hover:border-sp-muted'
                      }`}
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        signupForm.role === 'artist' ? 'bg-sp-green text-black' : 'bg-sp-border text-sp-subtext'
                      }`}>
                        <Mic2 className="h-5 w-5" />
                      </div>
                      <p className="font-bold text-xs">Artist</p>
                    </button>
                  </div>
                </div>

                {/* Role badge */}
                <div className={`rounded-lg px-4 py-3 text-xs ${
                  signupForm.role === 'artist'
                    ? 'bg-purple-900/30 text-purple-300'
                    : 'bg-blue-900/30 text-blue-300'
                }`}>
                  {signupForm.role === 'artist'
                    ? '🎤 Artists can upload songs, create albums, and manage their music library.'
                    : '🎧 Listeners can stream all music, save favorites, and explore albums & playlists.'}
                </div>

                {authError && (
                  <p className="rounded-md bg-red-900/40 px-4 py-2 text-center text-sm text-red-400">
                    {authError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="mt-2 rounded-full bg-sp-green py-3 font-bold text-black transition hover:bg-sp-green-h active:scale-95 disabled:opacity-50"
                >
                  {authLoading ? 'Creating account…' : 'Create Account'}
                </button>
              </form>

              <div className="mt-6 border-t border-sp-border pt-6 text-center text-sm text-sp-subtext">
                Already have an account?{' '}
                <button
                  onClick={() => { setAuthMode('login'); setAuthError(''); }}
                  className="font-bold text-white underline hover:text-sp-green transition"
                >
                  Log in
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }


  // ─── Main App ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen flex-col bg-sp-black text-sp-text select-none overflow-hidden">
      <audio ref={audioRef} />

      {/* Top Row: Sidebar + Main Content */}
      <div className="flex flex-1 gap-2 overflow-hidden p-2 pb-0">

        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <aside className="flex w-[280px] flex-shrink-0 flex-col gap-2">
          {/* Nav panel */}
          <div className="rounded-xl bg-sp-surface p-4">
            <nav className="flex flex-col gap-1">
              {[
                { icon: Home,    label: 'Home',    view: 'home'   },
                { icon: Search,  label: 'Search',  view: 'search' },
              ].map(({ icon: Icon, label, view }) => (
                <button
                  key={view}
                  onClick={() => setActiveView(view as any)}
                  className={`flex items-center gap-4 rounded-md px-3 py-2 text-sm font-semibold transition ${
                    activeView === view
                      ? 'text-sp-text'
                      : 'text-sp-subtext hover:text-sp-text'
                  }`}
                >
                  <Icon className={`h-6 w-6 ${activeView === view ? 'text-white' : ''}`} />
                  {label}
                </button>
              ))}

              {user?.role === 'artist' && (
                <button
                  onClick={() => setActiveView('upload')}
                  className={`flex items-center gap-4 rounded-md px-3 py-2 text-sm font-semibold transition mt-2 ${
                    activeView === 'upload'
                      ? 'bg-sp-elevated text-sp-green'
                      : 'text-sp-subtext hover:text-sp-text'
                  }`}
                >
                  <Plus className={`h-6 w-6 ${activeView === 'upload' ? 'text-sp-green' : ''}`} />
                  Upload Music
                </button>
              )}
            </nav>
          </div>

          {/* Library panel */}
          <div className="flex flex-1 flex-col overflow-hidden rounded-xl bg-sp-surface">
            <div className="flex items-center justify-between px-4 py-3">
              <button className="flex items-center gap-2 text-sm font-semibold text-sp-subtext hover:text-sp-text">
                <Library className="h-5 w-5" /> Your Library
              </button>
              <button className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-sp-elevated text-sp-subtext hover:text-sp-text">
                <Plus className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-4">
              {/* Liked Songs */}
              <div className="mb-1 flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-sp-elevated group">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded bg-gradient-to-br from-indigo-700 to-purple-900">
                  <Heart className="h-5 w-5 fill-white text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Liked Songs</p>
                  <p className="text-xs text-sp-subtext">Playlist · {songs.length} songs</p>
                </div>
              </div>

              {/* Albums */}
              {albums.map((album, i) => (
                <div
                  key={album._id}
                  onClick={() => { setSelectedAlbum(album); setActiveView('album'); }}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-sp-elevated group"
                >
                  <AlbumArt index={i} size={48} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{album.title}</p>
                    <p className="truncate text-xs text-sp-subtext">Album · {artistName(album.artist)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ── Main Content ─────────────────────────────────────────────────── */}
        <main className="flex flex-1 flex-col overflow-hidden rounded-xl bg-sp-surface">
          {/* Topbar */}
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex gap-2">
              <button className="flex h-8 w-8 items-center justify-center rounded-full bg-sp-black/50 hover:bg-sp-black">
                <ChevronLeft className="h-5 w-5 text-sp-subtext" />
              </button>
              <button className="flex h-8 w-8 items-center justify-center rounded-full bg-sp-black/50 hover:bg-sp-black">
                <ChevronRight className="h-5 w-5 text-sp-subtext" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <button className="rounded-full border border-sp-border px-4 py-1.5 text-sm font-semibold hover:border-white hover:scale-105 transition">
                Explore Premium
              </button>
              <button className="flex h-8 w-8 items-center justify-center rounded-full bg-sp-black/50 hover:bg-sp-black">
                <Bell className="h-4 w-4 text-sp-subtext" />
              </button>
              <button
                onClick={handleLogout}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-sp-elevated hover:bg-sp-hover"
              >
                <User className="h-4 w-4 text-sp-subtext" />
              </button>
            </div>
          </div>

          {/* View Content */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <AnimatePresence mode="wait">

              {/* ── HOME ── */}
              {activeView === 'home' && (
                <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <h2 className="mb-6 text-2xl font-bold">Good evening</h2>

                  {/* Quick picks row */}
                  {songs.length > 0 && (
                    <div className="mb-6 grid grid-cols-3 gap-3">
                      {songs.slice(0, 6).map((song, i) => (
                        <div
                          key={song._id}
                          onClick={() => playSong(song)}
                          className="flex cursor-pointer items-center gap-3 rounded-md bg-sp-elevated pr-4 hover:bg-[#333] group transition"
                        >
                          <AlbumArt index={i} size={56} />
                          <span className="truncate text-sm font-semibold">{song.title}</span>
                          <button className="ml-auto flex h-10 w-10 flex-shrink-0 translate-y-1 items-center justify-center rounded-full bg-sp-green opacity-0 shadow-lg group-hover:translate-y-0 group-hover:opacity-100 transition-all">
                            <Play className="h-5 w-5 fill-black text-black ml-0.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Albums section */}
                  <h3 className="mb-4 text-xl font-bold">Your Albums</h3>
                  {loading ? (
                    <div className="flex items-center gap-2 text-sp-subtext"><div className="h-4 w-4 animate-spin rounded-full border-2 border-sp-muted border-t-sp-green" /> Loading...</div>
                  ) : albums.length === 0 ? (
                    <p className="text-sp-subtext">No albums found. Upload some music!</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                      {albums.map((album, i) => (
                        <motion.div
                          key={album._id}
                          whileHover={{ scale: 1.03 }}
                          onClick={() => { setSelectedAlbum(album); setActiveView('album'); }}
                          className="cursor-pointer rounded-lg bg-sp-elevated p-4 transition hover:bg-sp-hover group"
                        >
                          <div className="relative mb-4">
                            <AlbumArt index={i} size={160} />
                            <button className="absolute bottom-2 right-2 flex h-12 w-12 translate-y-2 items-center justify-center rounded-full bg-sp-green opacity-0 shadow-xl group-hover:translate-y-0 group-hover:opacity-100 transition-all">
                              <Play className="h-5 w-5 fill-black text-black ml-0.5" />
                            </button>
                          </div>
                          <p className="truncate font-semibold">{album.title}</p>
                          <p className="mt-1 truncate text-xs text-sp-subtext">{artistName(album.artist)}</p>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* All Songs */}
                  {songs.length > 0 && (
                    <>
                      <h3 className="mb-4 mt-10 text-xl font-bold">All Songs</h3>
                      <SongTable songs={songs} currentSong={currentSong} isPlaying={isPlaying} onPlay={playSong} togglePlay={togglePlay} />
                    </>
                  )}
                </motion.div>
              )}

              {/* ── SEARCH ── */}
              {activeView === 'search' && (
                <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="mb-6 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-sp-muted" />
                    <input
                      autoFocus
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="What do you want to listen to?"
                      className="w-full rounded-full bg-sp-elevated py-3 pl-12 pr-4 text-sm text-sp-text placeholder-sp-muted outline-none focus:ring-2 focus:ring-white"
                    />
                  </div>
                  {searchQuery ? (
                    <>
                      <p className="mb-4 text-sm text-sp-subtext">Results for "{searchQuery}"</p>
                      {filteredSongs.length === 0 ? (
                        <p className="text-sp-subtext">No songs match.</p>
                      ) : (
                        <SongTable songs={filteredSongs} currentSong={currentSong} isPlaying={isPlaying} onPlay={playSong} togglePlay={togglePlay} />
                      )}
                    </>
                  ) : (
                    <div>
                      <h3 className="mb-4 text-xl font-bold">Browse All</h3>
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                        {['Pop', 'Hip-Hop', 'Rock', 'Electronic', 'Jazz', 'Classical', 'R&B', 'Indie'].map((genre, i) => (
                          <div key={genre} className={`rounded-lg p-4 h-24 flex items-end cursor-pointer bg-gradient-to-br ${PALETTES[i % PALETTES.length]}`}>
                            <span className="font-bold text-lg">{genre}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── ALBUM DETAIL ── */}
              {activeView === 'album' && selectedAlbum && (
                <motion.div key="album" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="mb-8 flex gap-6 items-end">
                    <AlbumArt index={albums.findIndex(a => a._id === selectedAlbum._id)} size={192} />
                    <div>
                      <p className="text-xs font-bold uppercase text-sp-subtext">Album</p>
                      <h2 className="mt-2 text-5xl font-black leading-tight">{selectedAlbum.title}</h2>
                      <p className="mt-4 text-sm text-sp-subtext">{artistName(selectedAlbum.artist)} · {selectedAlbum.musics?.length ?? 0} songs</p>
                    </div>
                  </div>
                  <div className="mb-4 flex items-center gap-4">
                    <button
                      onClick={() => { if (selectedAlbum.musics?.length) playSong(selectedAlbum.musics[0]); }}
                      className="flex h-14 w-14 items-center justify-center rounded-full bg-sp-green hover:bg-sp-green-h transition hover:scale-105"
                    >
                      <Play className="h-7 w-7 fill-black text-black ml-0.5" />
                    </button>
                    <button className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-sp-elevated text-sp-subtext hover:text-sp-text">
                      <Heart className="h-6 w-6" />
                    </button>
                    <button className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-sp-elevated text-sp-subtext hover:text-sp-text">
                      <MoreHorizontal className="h-6 w-6" />
                    </button>
                  </div>
                  <SongTable songs={selectedAlbum.musics ?? []} currentSong={currentSong} isPlaying={isPlaying} onPlay={playSong} togglePlay={togglePlay} />
                </motion.div>
              )}

              {/* ── ARTIST UPLOAD ── */}
              {activeView === 'upload' && user?.role === 'artist' && (
                <motion.div key="upload" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                  <div className="mb-8">
                    <h2 className="text-3xl font-black mb-2">Artist Dashboard</h2>
                    <p className="text-sp-subtext">Grow your catalog and reach new fans worldwide.</p>
                  </div>

                  <div className="max-w-2xl rounded-xl bg-sp-elevated p-8 border border-white/5">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                      <Music2 className="text-sp-green h-6 w-6" /> Upload New Track
                    </h3>

                    <form onSubmit={handleUpload} className="space-y-6">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-sp-subtext mb-2">Track Title</label>
                        <input
                          type="text"
                          required
                          value={uploadData.title}
                          onChange={e => setUploadData(p => ({ ...p, title: e.target.value }))}
                          className="w-full bg-sp-surface border border-sp-border rounded-md px-4 py-3 outline-none focus:border-sp-green transition"
                          placeholder="What is your song called?"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-sp-subtext mb-2">Audio File</label>
                        <div className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition ${
                          uploadData.file ? 'border-sp-green bg-sp-green/5' : 'border-sp-border bg-sp-surface/50 hover:border-sp-muted'
                        }`}>
                          <input
                            type="file"
                            accept="audio/*"
                            required
                            onChange={e => setUploadData(p => ({ ...p, file: e.target.files?.[0] || null }))}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          {uploadData.file ? (
                            <div className="flex flex-col items-center gap-2">
                              <Music2 className="h-10 w-10 text-sp-green" />
                              <p className="font-bold text-sp-green">{uploadData.file.name}</p>
                              <p className="text-xs text-sp-subtext">Click or drag to replace</p>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2">
                              <Plus className="h-10 w-10 text-sp-muted" />
                              <p className="font-bold">Choose an audio file</p>
                              <p className="text-xs text-sp-subtext">MP3, WAV, or OGG · Max 20MB</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {uploadStatus.error && (
                        <p className="bg-red-900/40 text-red-400 p-4 rounded-lg text-sm">{uploadStatus.error}</p>
                      )}

                      {uploadStatus.success && (
                        <p className="bg-sp-green/10 text-sp-green p-4 rounded-lg text-sm">Track uploaded successfully! It will appear in your library soon.</p>
                      )}

                      <button
                        type="submit"
                        disabled={uploadStatus.loading}
                        className="w-full bg-sp-green text-black font-bold py-4 rounded-full hover:bg-sp-green-h hover:scale-[1.02] active:scale-95 transition disabled:opacity-50 disabled:scale-100"
                      >
                        {uploadStatus.loading ? (
                          <span className="flex items-center justify-center gap-2">
                            <div className="h-4 w-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                            Uploading Track...
                          </span>
                        ) : 'Publish Track'}
                      </button>
                    </form>
                  </div>

                  {/* Create Album Section */}
                  <div className="max-w-2xl rounded-xl bg-sp-elevated p-8 border border-white/5 mt-8">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                      <Library className="text-sp-green h-6 w-6" /> Create New Album
                    </h3>

                    <form onSubmit={handleCreateAlbum} className="space-y-6">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-sp-subtext mb-2">Album Title</label>
                        <input
                          type="text"
                          required
                          value={albumData.title}
                          onChange={e => setAlbumData(p => ({ ...p, title: e.target.value }))}
                          className="w-full bg-sp-surface border border-sp-border rounded-md px-4 py-3 outline-none focus:border-sp-green transition"
                          placeholder="e.g. My Greatest Hits"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-sp-subtext mb-2">Select Your Tracks ({albumData.selectedSongs.length})</label>
                        {mySongs.length === 0 ? (
                          <p className="text-sm text-sp-subtext italic">You need to upload some tracks first!</p>
                        ) : (
                          <div className="max-h-48 overflow-y-auto border border-sp-border rounded-md bg-sp-surface/30">
                            {mySongs.map(song => (
                              <label key={song._id} className="flex items-center gap-3 p-3 hover:bg-white/5 cursor-pointer transition border-b border-white/5 last:border-0">
                                <input
                                  type="checkbox"
                                  checked={albumData.selectedSongs.includes(song._id)}
                                  onChange={e => {
                                    const checked = e.target.checked;
                                    setAlbumData(p => ({
                                      ...p,
                                      selectedSongs: checked
                                        ? [...p.selectedSongs, song._id]
                                        : p.selectedSongs.filter(id => id !== song._id)
                                    }));
                                  }}
                                  className="accent-sp-green h-4 w-4"
                                />
                                <span className="text-sm">{song.title}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>

                      {albumStatus.error && (
                        <p className="bg-red-900/40 text-red-400 p-4 rounded-lg text-sm">{albumStatus.error}</p>
                      )}

                      {albumStatus.success && (
                        <p className="bg-sp-green/10 text-sp-green p-4 rounded-lg text-sm">Album created successfully!</p>
                      )}

                      <button
                        type="submit"
                        disabled={albumStatus.loading || mySongs.length === 0}
                        className="w-full bg-sp-green text-black font-bold py-4 rounded-full hover:bg-sp-green-h hover:scale-[1.02] active:scale-95 transition disabled:opacity-50 disabled:scale-100"
                      >
                        {albumStatus.loading ? 'Creating Album...' : 'Create Album'}
                      </button>
                    </form>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* ── Player Bar ────────────────────────────────────────────────────────── */}
      <PlayerBar
        currentSong={currentSong}
        isPlaying={isPlaying}
        progress={progress}
        duration={duration}
        volume={volume}
        shuffle={shuffle}
        repeat={repeat}
        onTogglePlay={togglePlay}
        onPrev={skipPrev}
        onNext={skipNext}
        onSeek={v => { if (audioRef.current) audioRef.current.currentTime = v; setProgress(v); }}
        onVolume={setVolume}
        onShuffle={() => setShuffle(p => !p)}
        onRepeat={() => setRepeat(p => !p)}
      />
    </div>
  );
}

// ─── Song Table Component ──────────────────────────────────────────────────────
function SongTable({ songs, currentSong, isPlaying, onPlay, togglePlay }: {
  songs: Song[];
  currentSong: Song | null;
  isPlaying: boolean;
  onPlay: (s: Song) => void;
  togglePlay: () => void;
}) {
  const [hover, setHover] = useState<string | null>(null);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-2 grid grid-cols-[16px_1fr_1fr_80px] items-center gap-4 border-b border-sp-border pb-2 px-4 text-xs font-semibold uppercase tracking-wider text-sp-subtext">
        <span>#</span>
        <span>Title</span>
        <span>Artist</span>
        <Clock className="h-4 w-4 ml-auto" />
      </div>
      {songs.map((song, idx) => {
        const isCurrent = currentSong?._id === song._id;
        return (
          <div
            key={song._id}
            onMouseEnter={() => setHover(song._id)}
            onMouseLeave={() => setHover(null)}
            onDoubleClick={() => onPlay(song)}
            className={`group grid grid-cols-[16px_1fr_1fr_80px] items-center gap-4 rounded-md px-4 py-2 text-sm transition cursor-pointer ${
              isCurrent ? 'bg-sp-hover' : 'hover:bg-sp-elevated'
            }`}
          >
            {/* Index / Play icon */}
            <div className="flex items-center justify-center">
              {hover === song._id || isCurrent ? (
                isCurrent ? (
                  <button onClick={togglePlay}>
                    {isPlaying ? (
                      <Pause className="h-4 w-4 fill-sp-green text-sp-green" />
                    ) : (
                      <Play className="h-4 w-4 fill-white text-white" />
                    )}
                  </button>
                ) : (
                  <button onClick={() => onPlay(song)}>
                    <Play className="h-4 w-4 fill-white text-white" />
                  </button>
                )
              ) : (
                <span className={isCurrent ? 'text-sp-green font-semibold' : 'text-sp-subtext'}>
                  {isCurrent && isPlaying ? <PlayingBars /> : idx + 1}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 min-w-0">
              <AlbumArt index={idx} size={40} />
              <span className={`truncate font-medium ${isCurrent ? 'text-sp-green' : ''}`}>{song.title}</span>
            </div>
            <span className="truncate text-sp-subtext hover:text-white transition">{artistName(song.artist)}</span>
            <span className="ml-auto text-sp-subtext">— : ——</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Player Bar Component ──────────────────────────────────────────────────────
function PlayerBar({ currentSong, isPlaying, progress, duration, volume, shuffle, repeat, onTogglePlay, onPrev, onNext, onSeek, onVolume, onShuffle, onRepeat }: {
  currentSong: Song | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (v: number) => void;
  onVolume: (v: number) => void;
  onShuffle: () => void;
  onRepeat: () => void;
}) {
  return (
    <div className="flex h-[90px] flex-shrink-0 items-center justify-between gap-4 border-t border-sp-border bg-sp-black px-4">
      {/* Left: Now Playing info */}
      <div className="flex w-[280px] flex-shrink-0 items-center gap-3">
        {currentSong ? (
          <>
            <AlbumArt index={0} size={56} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{currentSong.title}</p>
              <p className="truncate text-xs text-sp-subtext">{artistName(currentSong.artist)}</p>
            </div>
            <button className="ml-2 flex-shrink-0 text-sp-subtext hover:text-sp-green transition">
              <Heart className="h-4 w-4" />
            </button>
          </>
        ) : (
          <p className="text-xs text-sp-subtext">Nothing playing</p>
        )}
      </div>

      {/* Center: Controls */}
      <div className="flex flex-1 flex-col items-center gap-2">
        <div className="flex items-center gap-5">
          <button onClick={onShuffle} className={`transition hover:text-white ${shuffle ? 'text-sp-green' : 'text-sp-subtext'}`}>
            <Shuffle className="h-4 w-4" />
          </button>
          <button onClick={onPrev} className="text-sp-subtext transition hover:text-white">
            <SkipBack className="h-5 w-5 fill-current" />
          </button>
          <button
            onClick={onTogglePlay}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black transition hover:scale-105"
          >
            {isPlaying ? <Pause className="h-4 w-4 fill-black" /> : <Play className="h-4 w-4 fill-black ml-0.5" />}
          </button>
          <button onClick={onNext} className="text-sp-subtext transition hover:text-white">
            <SkipForward className="h-5 w-5 fill-current" />
          </button>
          <button onClick={onRepeat} className={`transition hover:text-white ${repeat ? 'text-sp-green' : 'text-sp-subtext'}`}>
            <Repeat className="h-4 w-4" />
          </button>
        </div>
        {/* Progress bar */}
        <div className="flex w-full max-w-[600px] items-center gap-2">
          <span className="w-10 text-right text-[10px] text-sp-subtext">{fmtTime(progress)}</span>
          <input
            type="range"
            min={0}
            max={duration || 1}
            value={progress}
            onChange={e => onSeek(Number(e.target.value))}
            className="flex-1"
            style={{ backgroundSize: `${(progress / (duration || 1)) * 100}% 100%` }}
          />
          <span className="w-10 text-[10px] text-sp-subtext">{fmtTime(duration)}</span>
        </div>
      </div>

      {/* Right: Volume & extras */}
      <div className="flex w-[200px] flex-shrink-0 items-center justify-end gap-3">
        <button className="text-sp-subtext hover:text-white transition"><Mic2 className="h-4 w-4" /></button>
        <button className="text-sp-subtext hover:text-white transition"><ListMusic className="h-4 w-4" /></button>
        <Volume2 className="h-4 w-4 flex-shrink-0 text-sp-subtext" />
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={e => onVolume(Number(e.target.value))}
          className="w-24"
          style={{ backgroundSize: `${volume}% 100%` }}
        />
        <button className="text-sp-subtext hover:text-white transition"><Maximize2 className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
