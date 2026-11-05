'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, ChevronRight, Copy, Crown, Gauge, Headphones, Maximize2, Play, Radio, RotateCcw, ShieldCheck, Sparkles, Trophy, Users, Wifi, Zap, LogOut, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { connectSocket, emitWhenConnected, socket, syncClock } from '@/lib/socket'

type Participant = { id: string; name: string; online: boolean; buzz: null | { reactionTimeMs: number; rank: number | null }; falseStart?: boolean }
type LeaderboardEntry = { participantId: string; name: string; reactionTimeMs: number; rank: number; timingUncertaintyMs?: number }
type RoomState = {
  roomCode: string; roomName: string; hostName: string; hostOnline: boolean; phase: string;
  roundNumber: number; activationAt: number | null; roundId: string | null;
  participants: Participant[]; leaderboard: LeaderboardEntry[];
  overallLeaderboard: Array<{ participantId: string; name: string; points: number }>;
  roundHistory: Array<{ id: string; roundNumber: number; leaderboard: LeaderboardEntry[] }>
}
type Session = { roomCode: string; participantId?: string; sessionToken: string; name: string; role: 'host' | 'participant'; roundId?: string }

const emptyRoom: RoomState = { roomCode: '', roomName: 'Live Quiz', hostName: '', hostOnline: true, phase: 'waiting', roundNumber: 0, activationAt: null, roundId: null, participants: [], leaderboard: [], overallLeaderboard: [], roundHistory: [] }

function Logo() {
  return <div className="flex items-center gap-2.5"><div className="flex size-8 items-center justify-center rounded-lg bg-cyan-300 text-[#071017] shadow-[0_0_24px_rgba(0,229,255,.35)]"><Zap className="size-4 fill-current" /></div><span className="text-lg font-black tracking-[0.22em] text-white">BUZZR</span></div>
}
function Pill({ children, className = '' }: { children: React.ReactNode; className?: string }) { return <span className={`inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[.16em] text-slate-300 ${className}`}>{children}</span> }
function Stat({ icon: Icon, value, label }: { icon: typeof Users; value: string; label: string }) { return <div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-lg border border-white/10 bg-white/[.04] text-cyan-300"><Icon className="size-4" /></div><div><div className="font-mono text-sm font-bold text-white">{value}</div><div className="text-[10px] uppercase tracking-[.14em] text-slate-500">{label}</div></div></div> }

function Leaderboard({ rows, compact = false }: { rows: LeaderboardEntry[]; compact?: boolean }) {
  return <div className={`overflow-hidden rounded-2xl border border-white/10 bg-[#111827]/80 ${compact ? '' : 'shadow-2xl shadow-black/20'}`}>
    <div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div><div className="text-sm font-semibold text-white">Live leaderboard</div><div className="mt-0.5 text-xs text-slate-500">Fastest registered reactions</div></div><Pill className="border-cyan-300/20 bg-cyan-300/5 text-cyan-300"><Radio className="size-3" /> Live</Pill></div>
    {rows.length === 0 ? <div className="px-5 py-8 text-center text-sm text-slate-500">No buzzes registered yet. The leaderboard will update live.</div> : <div className="divide-y divide-white/[.06]">{rows.map((p, i) => <div key={p.participantId} className="flex items-center gap-3 px-5 py-3.5"><div className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-amber-300 text-[#1b1605]' : i === 1 ? 'bg-slate-300 text-slate-800' : i === 2 ? 'bg-orange-400/80 text-orange-950' : 'border border-white/10 text-slate-500'}`}>{i + 1}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-slate-200">{p.name}</div><div className="text-[10px] uppercase tracking-wider text-slate-600">{i === 0 ? 'Fastest this round' : 'Registered'}</div></div><div className="font-mono text-sm tabular-nums text-cyan-300">{p.reactionTimeMs.toFixed(3)}<span className="ml-1 text-[10px] text-slate-500">ms</span></div></div>)}</div>}
  </div>
}

function Home({ navigate }: { navigate: (p: string) => void }) {
  return <main className="min-h-screen overflow-hidden bg-[#080b12] text-slate-200"><div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:linear-gradient(to_bottom,black,transparent_75%)]" /><nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10"><Logo /><div className="hidden items-center gap-8 text-sm text-slate-400 md:flex"><a href="#how" className="transition hover:text-white">How it works</a><a href="#features" className="transition hover:text-white">Features</a><span className="h-4 w-px bg-white/10" /><span className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#22c55e]" />Live buzzer rooms</span></div><Button onClick={() => navigate('create')} className="rounded-lg bg-cyan-300 px-4 text-xs font-bold uppercase tracking-wider text-[#071017] hover:bg-cyan-200">Host a room <ArrowRight data-icon="inline-end" /></Button></nav>
    <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-16 px-6 pb-24 pt-16 lg:grid-cols-[1.05fr_.95fr] lg:px-10 lg:pb-36 lg:pt-24"><div><Pill className="border-cyan-300/20 bg-cyan-300/[.06] text-cyan-300"><Sparkles className="size-3" /> Built for the moment</Pill><h1 className="mt-7 max-w-2xl text-6xl font-black leading-[.95] tracking-[-.06em] text-white sm:text-7xl lg:text-8xl">Think fast.<br /><span className="bg-gradient-to-r from-cyan-300 via-cyan-100 to-violet-400 bg-clip-text text-transparent">Buzz first.</span></h1><p className="mt-7 max-w-lg text-lg leading-8 text-slate-400">The real-time buzzer platform for competitive quiz battles. One question. One click. Reaction-time rankings.</p><div className="mt-9 flex flex-wrap gap-3"><Button onClick={() => navigate('create')} size="lg" className="h-12 rounded-lg bg-cyan-300 px-6 font-bold text-[#071017] shadow-[0_0_30px_rgba(0,229,255,.15)] hover:bg-cyan-200">Host a room <ArrowRight data-icon="inline-end" /></Button><Button onClick={() => navigate('join')} size="lg" variant="outline" className="h-12 rounded-lg border-white/15 bg-white/[.03] px-6 font-bold text-white hover:bg-white/[.08]">Join a room <ChevronRight data-icon="inline-end" /></Button></div><div className="mt-12 flex flex-wrap gap-8 border-t border-white/10 pt-6"><Stat icon={Users} value="Live" label="Multiplayer rooms" /><Stat icon={Gauge} value="0.001 s" label="Display resolution" /><Stat icon={ShieldCheck} value="No" label="Player sign-up" /></div></div>
      <div className="relative"><div className="absolute -inset-10 rounded-full bg-cyan-400/10 blur-3xl" /><div className="relative rounded-3xl border border-white/10 bg-[#101522]/80 p-3 shadow-2xl shadow-black/40"><div className="rounded-2xl border border-white/10 bg-[#0b111c] p-5"><div className="mb-7 flex items-center justify-between"><div><div className="text-xs uppercase tracking-[.18em] text-slate-500">BUZZR preview</div><div className="mt-1 font-semibold text-white">The fastest response wins</div></div><Pill className="border-rose-400/20 bg-rose-400/5 text-rose-300"><span className="size-1.5 animate-pulse rounded-full bg-rose-400" /> Ready</Pill></div><div className="flex items-center justify-center py-5"><div className="relative flex size-52 items-center justify-center rounded-full border border-rose-400/30 bg-[radial-gradient(circle_at_35%_25%,#ff6675,#ff3b4f_46%,#a91429)] shadow-[0_0_0_12px_rgba(255,59,79,.06),0_0_70px_rgba(255,59,79,.4)]"><div className="absolute inset-3 rounded-full border border-white/20" /><div className="text-center"><div className="text-4xl font-black tracking-tight text-white">BUZZ!</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[.25em] text-white/60">tap once</div></div></div></div><div className="rounded-2xl border border-white/10 bg-[#111827]/80 p-5 text-center"><div className="text-sm font-semibold text-white">Live leaderboard</div><div className="mt-1 text-xs text-slate-500">Your room's real results appear here</div></div></div></div></div></section>
    <section id="how" className="relative z-10 mx-auto max-w-7xl border-t border-white/10 px-6 py-20 lg:px-10"><div className="max-w-xl"><Pill>How it works</Pill><h2 className="mt-5 text-4xl font-bold tracking-tight text-white">Built for the rush.</h2><p className="mt-3 text-slate-400">From setup to final scoreboard, every moment stays in sync.</p></div><div className="mt-12 grid gap-4 md:grid-cols-3">{[['01','Create a room','Set the stage and get a unique room code in seconds.'],['02','Invite your players','Share the code. No accounts, no friction, just names.'],['03','Buzz and compete','Ask your question, start the round, and let the fastest think win.']].map(([n,t,d]) => <div key={n} className="rounded-2xl border border-white/10 bg-white/[.025] p-6"><div className="font-mono text-sm text-cyan-300">/{n}</div><h3 className="mt-10 text-xl font-semibold text-white">{t}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{d}</p></div>)}</div></section>
    <section id="features" className="relative z-10 mx-auto max-w-7xl border-t border-white/10 px-6 py-20 lg:px-10"><div className="grid gap-8 md:grid-cols-2 lg:grid-cols-5">{([[Radio,'Real-time multiplayer'],[Gauge,'Reaction-time tracking'],[Trophy,'Live leaderboards'],[RotateCcw,'Multiple rounds'],[ShieldCheck,'No registration']] as [typeof Radio, string][]).map(([I,t]) => <div key={t} className="flex items-center gap-3 text-sm text-slate-400"><div className="flex size-9 items-center justify-center rounded-lg bg-cyan-300/10 text-cyan-300"><I className="size-4" /></div>{t}</div>)}</div></section><footer className="relative z-10 mx-auto flex max-w-7xl items-center justify-between border-t border-white/10 px-6 py-8 text-xs text-slate-600 lg:px-10"><Logo /><span>BUZZR · Think Fast. Buzz First.</span></footer></main>
}

function Setup({ mode, navigate }: { mode: 'create' | 'join'; navigate: (p: string) => void }) {
  const [name, setName] = useState('')
  const [event, setEvent] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = () => {
    if (!name.trim() || (mode === 'join' && !code.trim())) { setError('Please complete the required fields.'); return }
    setBusy(true); setError('')
    connectSocket()
    emitWhenConnected(mode === 'create' ? 'create-room' : 'join-room', mode === 'create' ? { hostName: name, roomName: event } : { roomCode: code.trim().toUpperCase(), participantName: name }, (result: any) => {
      setBusy(false)
      if (!result?.ok) { setError(result?.error || 'Unable to connect to room.'); return }
      const session: Session = { roomCode: result.roomCode, participantId: result.participantId, sessionToken: result.sessionToken, name, role: mode === 'create' ? 'host' : 'participant' }
      sessionStorage.setItem('buzzr-session', JSON.stringify(session))
      navigate(mode === 'create' ? 'host' : 'participant')
    })
  }
  return <main className="flex min-h-screen items-center justify-center bg-[#080b12] px-6 text-slate-200"><div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(0,229,255,.08),transparent_35%)]" /><div className="relative w-full max-w-md"><button onClick={() => navigate('home')} className="mb-10 text-sm text-slate-500 transition hover:text-white">← Back to home</button><Logo /><div className="mt-12"><Pill className="text-cyan-300">{mode === 'create' ? 'Host console' : 'Player entry'}</Pill><h1 className="mt-5 text-4xl font-bold tracking-tight text-white">{mode === 'create' ? 'Set the stage.' : 'Jump into the action.'}</h1><p className="mt-3 leading-6 text-slate-500">{mode === 'create' ? 'Create a room and get your players ready to buzz.' : 'Enter your room code and choose a name to join.'}</p><div className="mt-9 flex flex-col gap-5">{mode === 'join' && <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Room code<input value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={12} placeholder="QUIZXXXXXXXX" className="h-12 rounded-lg border border-white/10 bg-white/[.04] px-4 font-mono text-lg tracking-[.12em] text-white outline-none transition focus:border-cyan-300/60" /></label>}<label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{mode === 'create' ? 'Your name' : 'Display name'}<input value={name} onChange={e => setName(e.target.value)} maxLength={32} placeholder={mode === 'create' ? 'e.g. Alex Morgan' : 'e.g. Maya Chen'} className="h-12 rounded-lg border border-white/10 bg-white/[.04] px-4 text-sm text-white outline-none transition placeholder:text-slate-700 focus:border-cyan-300/60" /></label>{mode === 'create' && <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Event name <span className="font-normal normal-case tracking-normal text-slate-600">Optional</span><input value={event} onChange={e => setEvent(e.target.value)} maxLength={32} placeholder="e.g. Friday Night Quiz" className="h-12 rounded-lg border border-white/10 bg-white/[.04] px-4 text-sm text-white outline-none transition placeholder:text-slate-700 focus:border-cyan-300/60" /></label>}{error && <p role="alert" className="text-sm text-rose-300">{error}</p>}<Button onClick={submit} disabled={busy} className="mt-3 h-12 rounded-lg bg-cyan-300 font-bold text-[#071017] hover:bg-cyan-200">{busy ? 'Connecting…' : mode === 'create' ? 'Create room' : 'Join room'} <ArrowRight data-icon="inline-end" /></Button></div></div></div></main>
}

function AppRoom({ participant, navigate }: { participant: boolean; navigate: (p: string) => void }) {
  const [session, setSession] = useState<Session | null>(null)
  const [room, setRoom] = useState<RoomState>(emptyRoom)
  const [phase, setPhase] = useState('connecting')
  const [myBuzz, setMyBuzz] = useState<{ reactionTimeMs: number; rank?: number } | null>(null)
  const [clock, setClock] = useState<{ offset: number; rtt: number; uncertainty: number } | null>(null)
  const [message, setMessage] = useState('')
  const clockRef = useRef(clock)
  const activationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionRef = useRef<Session | null>(null)
  useEffect(() => { clockRef.current = clock }, [clock])
  useEffect(() => { sessionRef.current = session }, [session])

  useEffect(() => {
    const saved = sessionStorage.getItem('buzzr-session')
    if (!saved) { navigate('home'); return }
    const parsed = JSON.parse(saved) as Session
    if ((participant && parsed.role !== 'participant') || (!participant && parsed.role !== 'host')) { navigate('home'); return }
    setSession(parsed)
    connectSocket()
    const restore = () => emitWhenConnected('reconnect-session', { roomCode: parsed.roomCode, sessionToken: parsed.sessionToken }, (result: any) => {
      if (!result?.ok) { setMessage(result?.error || 'Your session could not be restored.'); setPhase('error'); return }
      setRoom(result.room || emptyRoom)
      setPhase(result.room?.phase || 'waiting')
      const own = result.room?.participants?.find((p: Participant) => p.id === result.participantId || p.id === parsed.participantId)
      if (own?.buzz) setMyBuzz({ reactionTimeMs: own.buzz.reactionTimeMs, rank: own.buzz.rank || undefined })
    })
    const onState = (next: RoomState) => {
      setRoom(next)
      setPhase(next.phase)
      if (parsed.role === 'participant') {
        const own = next.participants?.find(p => p.id === parsed.participantId)
        if (own?.buzz) setMyBuzz({ reactionTimeMs: own.buzz.reactionTimeMs, rank: own.buzz.rank || undefined })
        else if (next.phase === 'waiting' || next.phase === 'preparing' || next.phase === 'active') setMyBuzz(null)
      }
    }
    const onRoundStarted = ({ roundId, activationAt, roundNumber }: { roundId: string; activationAt: number; roundNumber: number }) => {
      const updated = { ...parsed, roundId }
      sessionStorage.setItem('buzzr-session', JSON.stringify(updated)); setSession(updated)
      setMyBuzz(null); setPhase('preparing')
      if (activationTimer.current) clearTimeout(activationTimer.current)
      const offset = clockRef.current?.offset ?? 0
      const delay = Math.max(0, activationAt - (performance.now() + offset))
      activationTimer.current = setTimeout(() => {
        if (performance.now() + (clockRef.current?.offset ?? 0) >= activationAt) setPhase('active')
        else setPhase('preparing')
      }, delay)
      setRoom(current => ({ ...current, roundNumber, roundId, activationAt, phase: 'preparing' }))
    }
    const onRoundEnded = () => { if (activationTimer.current) clearTimeout(activationTimer.current); setPhase('ended') }
    const onReset = () => { if (activationTimer.current) clearTimeout(activationTimer.current); setMyBuzz(null); setPhase('waiting') }
    const onRoomEnded = () => { sessionStorage.removeItem('buzzr-session'); setMessage('This room has ended.'); setPhase('room-ended') }
    const onBuzz = ({ participantId }: { participantId: string }) => { if (participantId === parsed.participantId) setPhase('registered') }
    const onHostDisconnected = () => setMessage('Host connection lost. Waiting for the host to reconnect…')
    const onDisconnect = () => setMessage('Connection lost. Reconnecting…')
    const onConnect = () => { setMessage(''); restore() }
    socket.on('room-state', onState)
    socket.on('round-started', onRoundStarted)
    socket.on('round-ended', onRoundEnded)
    socket.on('round-reset', onReset)
    socket.on('room-ended', onRoomEnded)
    socket.on('buzz-registered', onBuzz)
    socket.on('host-disconnected', onHostDisconnected)
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    if (socket.connected) restore()
    let alive = true
    const refreshClock = async () => { if (!socket.connected) return; const result = await syncClock(5); if (alive && result) setClock(result) }
    refreshClock()
    const clockInterval = setInterval(refreshClock, 10000)
    return () => {
      alive = false; clearInterval(clockInterval)
      if (activationTimer.current) clearTimeout(activationTimer.current)
      socket.off('room-state', onState); socket.off('round-started', onRoundStarted)
      socket.off('round-ended', onRoundEnded); socket.off('round-reset', onReset)
      socket.off('room-ended', onRoomEnded); socket.off('buzz-registered', onBuzz)
      socket.off('host-disconnected', onHostDisconnected); socket.off('connect', onConnect); socket.off('disconnect', onDisconnect)
    }
  }, [participant, navigate])

  const runHostAction = useCallback((event: string) => {
    if (!session) return
    emitWhenConnected(event, { roomCode: session.roomCode }, (result: any) => {
      if (!result?.ok) setMessage(result?.error || 'Action failed.')
      else setMessage('')
    })
  }, [session])

  const buzz = () => {
    if (!session || !room.roundId || phase !== 'active' || myBuzz) return
    const clickPerf = performance.now()
    const sync = clockRef.current
    if (!sync) { setMessage('Synchronising your device clock. Please wait a moment.'); return }
    setMyBuzz({ reactionTimeMs: -1 })
    socket.emit('submit-buzz', {
      roomCode: session.roomCode,
      participantId: session.participantId,
      roundId: room.roundId,
      clientClickPerf: clickPerf,
      estimatedServerClickAt: clickPerf + sync.offset,
      clockOffsetMs: sync.offset,
      roundTripTimeMs: sync.rtt,
      timingUncertaintyMs: sync.uncertainty,
    }, (result: any) => {
      if (!result?.ok) { setMyBuzz(null); setMessage(result?.error || 'Your buzz was not registered.'); return }
      setMyBuzz({ reactionTimeMs: result.reactionTimeMs, rank: result.rank })
      setPhase('registered')
      setMessage('')
    })
  }

  const copy = async (value: string) => { try { await navigator.clipboard.writeText(value); setMessage('Copied to clipboard.') } catch { setMessage('Unable to access clipboard.') } }
  const fullscreen = () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.() }
  const own = room.participants.find(p => p.id === session?.participantId)
  const onlineCount = room.participants.filter(p => p.online).length
  const myRank = myBuzz?.rank || room.leaderboard.find(p => p.participantId === session?.participantId)?.rank

  if (phase === 'room-ended') return <main className="flex min-h-screen items-center justify-center bg-[#080b12] p-6 text-center text-white"><div><Logo /><h1 className="mt-8 text-3xl font-bold">Room ended</h1><p className="mt-3 text-slate-400">{message || 'The host has ended this room.'}</p><Button onClick={() => navigate('home')} className="mt-8 bg-cyan-300 text-slate-950">Back home</Button></div></main>

  return <main className="min-h-screen bg-[#080b12] text-slate-200"><header className="border-b border-white/10 bg-[#0b1019]/90 px-6 py-4"><div className="mx-auto flex max-w-7xl items-center justify-between"><Logo /><div className="flex items-center gap-3"><div className="hidden text-right sm:block"><div className="text-[10px] uppercase tracking-[.18em] text-slate-600">{room.roomName}</div><div className="font-mono text-sm text-white">{session?.roomCode}</div></div>{!participant && <Button variant="ghost" size="icon" onClick={fullscreen} className="text-slate-400 hover:text-white" aria-label="Toggle fullscreen"><Maximize2 /></Button>}<Pill className={socket.connected ? 'border-emerald-400/20 text-emerald-300' : 'border-rose-400/20 text-rose-300'}><span className={`size-1.5 rounded-full ${socket.connected ? 'bg-emerald-400' : 'bg-rose-400'}`} />{socket.connected ? 'Connected' : 'Reconnecting'}</Pill></div></div></header>
    {participant ? <div className="mx-auto flex min-h-[calc(100vh-73px)] max-w-3xl flex-col items-center px-6 py-10 text-center"><div className="flex w-full items-center justify-between text-left"><div><div className="text-xs uppercase tracking-[.18em] text-slate-600">Playing as</div><div className="mt-1 text-lg font-semibold text-white">{session?.name}</div></div><Pill><Users className="size-3" /> {onlineCount} online</Pill></div><div className="flex flex-1 flex-col items-center justify-center py-12">
      {myBuzz && myBuzz.reactionTimeMs >= 0 ? <div className="animate-in fade-in zoom-in flex flex-col items-center"><div className="flex size-28 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-400 shadow-[0_0_60px_rgba(34,197,94,.2)]"><Check className="size-14" /></div><div className="mt-8 text-2xl font-bold text-white">BUZZ REGISTERED!</div><div className="mt-3 font-mono text-3xl text-cyan-300">{myBuzz.reactionTimeMs.toFixed(3)} <span className="text-base text-slate-500">ms</span></div><p className="mt-5 text-sm text-slate-500">{myRank ? <>Your rank: <span className="font-semibold text-white">#{myRank}</span></> : 'Your response has been recorded.'}</p></div>
      : myBuzz ? <div className="text-lg font-semibold text-cyan-300">Registering your buzz…</div>
      : phase === 'active' ? <><div className="mb-9 text-sm font-semibold uppercase tracking-[.24em] text-rose-300">Round {String(room.roundNumber).padStart(2, '0')} · Buzz now</div><button onClick={buzz} className="group relative flex size-72 touch-manipulation select-none items-center justify-center rounded-full border border-rose-300/50 bg-[radial-gradient(circle_at_35%_25%,#ff6675,#ff3b4f_46%,#a91429)] shadow-[0_0_0_16px_rgba(255,59,79,.06),0_0_100px_rgba(255,59,79,.35)] transition duration-150 active:scale-95 sm:size-80"><span className="absolute inset-4 rounded-full border border-white/20" /><span className="text-5xl font-black text-white">BUZZ!</span></button><div className="mt-8 text-xs uppercase tracking-[.16em] text-slate-600">Tap once · fastest response wins</div></>
      : phase === 'preparing' ? <><div className="mb-7 flex size-16 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/5 text-cyan-300"><Headphones className="size-7" /></div><div className="font-mono text-5xl font-bold tabular-nums text-white">GET READY</div><p className="mt-3 text-sm text-slate-500">The buzzer is about to activate. Keep your finger ready.</p></>
      : phase === 'ended' || phase === 'results' ? <><div className="text-sm font-semibold uppercase tracking-[.24em] text-cyan-300">Round ended</div><p className="mt-3 text-sm text-slate-500">Waiting for the host to start the next round.</p></>
      : <><div className="mb-7 flex size-16 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/5 text-cyan-300"><Headphones className="size-7" /></div><div className="text-sm font-semibold uppercase tracking-[.24em] text-cyan-300">Waiting for host</div><p className="mt-3 max-w-xs text-sm leading-6 text-slate-500">The next round will begin when the host starts the buzzer.</p></>}
      </div><div className="w-full border-t border-white/10 pt-5"><div className="flex items-center justify-between text-xs text-slate-600"><span>Round {String(room.roundNumber).padStart(2, '0')}</span><span className="flex items-center gap-1.5"><ShieldCheck className="size-3 text-emerald-400" />{clock ? `Clock synced · ±${clock.uncertainty.toFixed(1)} ms` : 'Synchronising clock…'}</span></div>{message && <p role="status" className="mt-3 text-sm text-amber-300">{message}</p>}</div></div>
    : <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10"><div className="flex flex-wrap items-end justify-between gap-5"><div><div className="flex items-center gap-2"><Pill className="border-cyan-300/20 bg-cyan-300/5 text-cyan-300">Host console</Pill><span className="text-xs text-slate-600">{room.roomName}</span></div><h1 className="mt-4 text-3xl font-bold tracking-tight text-white">Room control center</h1><p className="mt-2 text-sm text-slate-500">Manage the room, launch rounds, and watch the action unfold.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => copy(room.roomCode)} className="border-white/10 bg-white/[.03] text-slate-300"><Copy data-icon="inline-start" /> {room.roomCode}</Button><Button onClick={() => runHostAction('end-room')} variant="ghost" className="text-rose-300"><LogOut data-icon="inline-start" /> End room</Button></div></div>
      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_1.35fr]"><section className="rounded-2xl border border-white/10 bg-[#111827]/80"><div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div className="font-semibold text-white">Participants <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-400">{room.participants.length}</span></div><span className="flex items-center gap-1.5 text-xs text-emerald-400"><span className="size-1.5 rounded-full bg-emerald-400" /> {onlineCount} online</span></div><div className="divide-y divide-white/[.06]">{room.participants.length === 0 ? <div className="px-5 py-10 text-center text-sm text-slate-500">Share the room code to invite participants.</div> : room.participants.map(p => <div key={p.id} className="flex items-center gap-3 px-5 py-4"><div className="flex size-9 items-center justify-center rounded-full bg-cyan-300/10 text-xs font-bold text-cyan-200">{p.name.slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2 text-sm font-medium text-slate-200">{p.name}</div><div className="mt-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-600"><span className={`size-1.5 rounded-full ${p.online ? 'bg-emerald-400' : 'bg-slate-600'}`} />{p.online ? 'Online' : 'Offline'}{p.falseStart ? ' · False start' : ''}</div></div>{p.buzz ? <span className="font-mono text-xs text-cyan-300">{p.buzz.reactionTimeMs.toFixed(3)} ms</span> : <span className="text-[10px] uppercase tracking-wider text-slate-600">{p.online ? 'Ready' : 'Offline'}</span>}</div>)}</div></section>
      <section className="rounded-2xl border border-white/10 bg-[#111827]/80 p-6"><div className="flex items-center justify-between"><div><div className="text-xs uppercase tracking-[.18em] text-slate-600">Current round</div><div className="mt-1 text-xl font-bold text-white">Round {String(room.roundNumber).padStart(2, '0')}</div></div><Pill className={phase === 'active' ? 'border-rose-400/20 bg-rose-400/5 text-rose-300' : 'text-slate-400'}><span className={`size-1.5 rounded-full ${phase === 'active' ? 'animate-pulse bg-rose-400' : 'bg-slate-500'}`} />{phase === 'active' ? 'Active round' : phase === 'preparing' ? 'Preparing' : phase === 'ended' || phase === 'results' ? 'Round ended' : 'Standby'}</Pill></div><div className="my-10 flex items-center justify-center"><div className={`flex size-48 items-center justify-center rounded-full border ${phase === 'active' ? 'border-rose-300/50 bg-rose-400/10 shadow-[0_0_70px_rgba(255,59,79,.2)]' : 'border-white/10 bg-white/[.025]'}`}><div className="text-center"><div className={`font-mono text-4xl font-bold ${phase === 'active' ? 'text-rose-300' : 'text-slate-600'}`}>{phase === 'active' ? 'LIVE' : phase === 'preparing' ? 'READY' : '—'}</div><div className="mt-2 text-[10px] uppercase tracking-[.18em] text-slate-600">{phase === 'active' ? 'buzzing now' : 'ready when you are'}</div></div></div></div><Button onClick={() => runHostAction('start-round')} disabled={['preparing', 'active'].includes(phase)} className="h-12 w-full rounded-lg bg-rose-400 font-bold uppercase tracking-[.16em] text-white shadow-[0_0_25px_rgba(255,59,79,.15)] hover:bg-rose-300 disabled:opacity-50"><Play data-icon="inline-start" /> {phase === 'active' ? 'Round active' : phase === 'preparing' ? 'Preparing round' : 'Start buzzer'}</Button><div className="mt-3 grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => runHostAction('reset-round')} className="border-white/10 text-xs text-slate-400"><RotateCcw data-icon="inline-start" /> Reset round</Button><Button variant="outline" onClick={() => runHostAction('end-round')} disabled={!['preparing', 'active'].includes(phase)} className="border-white/10 text-xs text-slate-400"><Square data-icon="inline-start" /> End round</Button></div><p className="mt-3 text-xs text-slate-600">A new round starts automatically after the previous round has ended.</p></section></div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2"><Leaderboard rows={room.leaderboard} /><section className="rounded-2xl border border-white/10 bg-[#111827]/80 p-5"><div className="flex items-center gap-2 text-sm font-semibold text-white"><Trophy className="size-4 text-amber-300" /> Overall points</div>{room.overallLeaderboard.length ? <div className="mt-4 space-y-3">{room.overallLeaderboard.map((p, i) => <div key={p.participantId} className="flex items-center gap-3 text-sm"><span className="w-5 font-mono text-slate-500">{i + 1}</span><span className="flex-1 text-slate-300">{p.name}</span><span className="font-mono text-cyan-300">{p.points} pts</span></div>)}</div> : <p className="mt-4 text-sm text-slate-500">Points appear after a round is completed.</p>}</section></div>{message && <p role="status" className="mt-4 text-sm text-amber-300">{message}</p>}</div>}
  </main>
}

export default function Page() {
  const [page, setPage] = useState('home')
  return page === 'home' ? <Home navigate={setPage} /> : page === 'create' ? <Setup mode="create" navigate={setPage} /> : page === 'join' ? <Setup mode="join" navigate={setPage} /> : <AppRoom participant={page === 'participant'} navigate={setPage} />
}
