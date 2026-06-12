/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy,
  Zap,
  Moon,
  Sun,
  RotateCcw,
  Play,
  Pause,
  Compass,
  Keyboard,
  Info,
  Clock,
  Sparkles,
  Volume2,
  VolumeX,
  Flame,
  Activity,
  Award,
  CloudRain,
  Video,
  Radio,
  Maximize2,
  Minimize2
} from 'lucide-react';
import Leaderboard from './components/Leaderboard';
import { Racer, GameSettings, Star, Particle, RaceStatus } from './types';

// Web Audio Synthesizer mimicking a high-revving 399cc inline 4-cylinder supersport engine
class NinjaEngineSynth {
  private ctx: AudioContext | null = null;
  private oscBase: OscillatorNode | null = null;
  private oscHarmonic1: OscillatorNode | null = null;
  private oscSub: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private isRunning: boolean = false;

  init() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  }

  start() {
    if (!this.ctx) this.init();
    if (!this.ctx || this.isRunning) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    try {
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(0.0, this.ctx.currentTime);

      // Main inline-4 primary hum (sawtooth)
      this.oscBase = this.ctx.createOscillator();
      this.oscBase.type = 'sawtooth';

      // Inline-4 high-pitch mechanical scream (sawtooth at higher octave)
      this.oscHarmonic1 = this.ctx.createOscillator();
      this.oscHarmonic1.type = 'sawtooth';

      // Cylindrical low rumbling undertone
      this.oscSub = this.ctx.createOscillator();
      this.oscSub.type = 'triangle';

      this.oscBase.connect(this.gainNode);
      this.oscHarmonic1.connect(this.gainNode);
      this.oscSub.connect(this.gainNode);
      this.gainNode.connect(this.ctx.destination);

      this.oscBase.start();
      this.oscHarmonic1.start();
      this.oscSub.start();
      this.isRunning = true;
    } catch (e) {
      console.warn("Could not start audio elements", e);
    }
  }

  update(rpm: number, alignment: number) {
    if (!this.isRunning || !this.ctx || !this.gainNode) return;
    try {
      const now = this.ctx.currentTime;
      // Map 1500 - 16000 RPM smoothly to audio fundamental frequencies
      const pitchFactor = rpm / 16050; 
      const fundamental = 38 + pitchFactor * 190; // 38Hz to 228Hz base

      if (this.oscBase) {
        this.oscBase.frequency.setValueAtTime(fundamental, now);
      }
      if (this.oscHarmonic1) {
        // High harmonic scream
        this.oscHarmonic1.frequency.setValueAtTime(fundamental * 2.5, now);
      }
      if (this.oscSub) {
        this.oscSub.frequency.setValueAtTime(fundamental * 0.5, now);
      }

      // Volume increases at full throttle throttle RPMs
      const alignmentBonusFactor = alignment > 80 ? 0.05 : 0.0;
      const targetVol = 0.01 + (rpm / 16000) * 0.07 + alignmentBonusFactor;
      this.gainNode.gain.setTargetAtTime(targetVol, now, 0.05);
    } catch (e) {}
  }

  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    try {
      if (this.oscBase) { this.oscBase.stop(); this.oscBase.disconnect(); }
      if (this.oscHarmonic1) { this.oscHarmonic1.stop(); this.oscHarmonic1.disconnect(); }
      if (this.oscSub) { this.oscSub.stop(); this.oscSub.disconnect(); }
      if (this.gainNode) { this.gainNode.disconnect(); }
    } catch (e) {}
  }
}

export default function App() {
  const [raceStatus, setRaceStatus] = useState<RaceStatus>('idle');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('04:12:33');
  const [stamina, setStamina] = useState<number>(100); // represents throttle heat/stamina
  const [raceDistance, setRaceDistance] = useState<number>(3500); // meters
  const [activeTab, setActiveTab] = useState<'play' | 'diy-guide'>('play');
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(true); // default muted to respect client autoplay rules
  const [weather, setWeather] = useState<'clear' | 'rain'>('clear');
  const [cameraAngle, setCameraAngle] = useState<'cinematic' | 'low-angle' | 'warp'>('cinematic');
  const [raytraced, setRaytraced] = useState<boolean>(true);
  const [activeKeysState, setActiveKeysState] = useState<{ [key: string]: boolean }>({});

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const toggleFullscreen = async () => {
    const element = document.getElementById('highway-canvas');
    if (!element) return;

    try {
      if (!document.fullscreenElement) {
        await element.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error("Fullscreen alignment error:", err);
      setIsFullscreen(prev => !prev);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const [commentary, setCommentary] = useState<{
    id: string;
    text: string;
    type: 'speed' | 'near-miss' | 'rank' | 'start' | 'finish' | 'redline';
    timestamp: number;
  } | null>(null);

  const triggerCommentary = (text: string, type: 'speed' | 'near-miss' | 'rank' | 'start' | 'finish' | 'redline') => {
    setCommentary({
      id: Math.random().toString(36).substr(2, 9),
      text,
      type,
      timestamp: Date.now()
    });
  };

  const triggerCommentaryRef = useRef(triggerCommentary);
  useEffect(() => {
    triggerCommentaryRef.current = triggerCommentary;
  });

  const commentatorStateRef = useRef({
    lastNearMissTime: 0,
    lastRankUpTime: 0,
    lastRankDownTime: 0,
    lastTopSpeedTime: 0,
    lastRedlineTime: 0,
    currentPostRank: 2, // Player starts in 2nd place
    hasTriggeredTopSpeed: false,
  });

  // Auto-dismiss commentator toasts after 4.2 seconds
  useEffect(() => {
    if (!commentary) return;
    const t = setTimeout(() => {
      setCommentary(null);
    }, 4200);
    return () => clearTimeout(t);
  }, [commentary]);

  // Keep shifting between weather core automatically every 18 seconds
  useEffect(() => {
    const weatherInterval = setInterval(() => {
      setWeather(prev => {
        const nextWeather = prev === 'clear' ? 'rain' : 'clear';
        // Only trigger commentary during active racing to avoid spamming the main menu
        if (gameStateRef.current.status === 'racing') {
          const quotes = nextWeather === 'rain'
            ? [
                "Atmospheric shift! Pre-charge ion levels alert: Rain incoming!",
                "Moisture sensors triggered. Traction control auto-adjusting to wet conditions!",
                "Showers starting over the speedway! Twist that throttle carefully down the wet pavement!"
              ]
            : [
                "Skies are clearing up! The asphalt is drying out for maximum adhesion!",
                "Rain cleared. Engage high-velocity slipstream thrust!",
                "Skies clear. High grip compound coupling fully enabled again!"
              ];
          triggerCommentaryRef.current(quotes[Math.floor(Math.random() * quotes.length)], 'redline');
        }
        return nextWeather;
      });
    }, 18000);

    return () => clearInterval(weatherInterval);
  }, []);

  // Keep changing camera angle in few intervals (every 9 seconds)
  useEffect(() => {
    const cameraInterval = setInterval(() => {
      setCameraAngle(prev => {
        const angles: ('cinematic' | 'low-angle' | 'warp')[] = ['cinematic', 'low-angle', 'warp'];
        const currentIndex = angles.indexOf(prev);
        const nextIndex = (currentIndex + 1) % angles.length;
        const nextAngle = angles[nextIndex];
        
        // Show commentary notification during active racing
        if (gameStateRef.current.status === 'racing') {
          const cameraNames = {
            'cinematic': 'UE5 cinematic orbit view',
            'low-angle': 'ground level dynamic capture',
            'warp': 'high-velocity forward cockpit warp'
          };
          triggerCommentaryRef.current(`Camera feed re-routed to automatic: ${cameraNames[nextAngle]}!`, 'speed');
        }
        return nextAngle;
      });
    }, 9000);

    return () => clearInterval(cameraInterval);
  }, []);

  // Control and theme settings
  const [settings, setSettings] = useState<GameSettings>({
    totalDistance: 3500,
    isLowLightTheme: true, // starts with Sleek Dark Mode (Sleek Interface)
    uiColorStyle: 'neon-cyan',
    controlMethod: 'keyboard',
  });

  // Kawasaki Ninja specifications state
  const [playerGear, setPlayerGear] = useState<number>(1);
  const [playerRpm, setPlayerRpm] = useState<number>(1350);

  // Competitor list state - 400cc sport class motorcycles
  const [racers, setRacers] = useState<Racer[]>([
    {
      id: 'player',
      name: 'ZX-Custom (EV-X)',
      avatar: '🏍️',
      color: '#ff007f', // Cyber Neon Pink accent
      speed: 0,
      targetSpeed: 0,
      distance: 0,
      rank: 2,
      isPlayer: true,
      lightAlignment: 100,
      engineRpm: 1350,
    },
    {
      id: 'racer_1',
      name: 'D3-SYS Cyclone',
      avatar: '🤖',
      color: '#00e5ff', // Neon Cyan accent
      speed: 0,
      targetSpeed: 0,
      distance: 12,
      rank: 1,
      isPlayer: false,
      lightAlignment: 0,
      engineRpm: 1350,
    },
    {
      id: 'racer_2',
      name: 'EVX CyberPhantom',
      avatar: '🧬',
      color: '#a855f7', // Purple accent
      speed: 0,
      targetSpeed: 0,
      distance: -8,
      rank: 3,
      isPlayer: false,
      lightAlignment: 0,
      engineRpm: 1350,
    },
    {
      id: 'racer_3',
      name: 'Brembo Interceptor',
      avatar: '🦊',
      color: '#fbbf24', // Amber accent
      speed: 0,
      targetSpeed: 0,
      distance: -20,
      rank: 4,
      isPlayer: false,
      lightAlignment: 0,
      engineRpm: 1350,
    }
  ]);

  // Player position offset on track height (-45 to 45 pixels from centerline)
  const [playerSteeringY, setPlayerSteeringY] = useState<number>(0);
  const [targetSteeringY, setTargetSteeringY] = useState<number>(0);

  // References for layout & systems
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineSynthRef = useRef<NinjaEngineSynth | null>(null);

  // Initialize Audio synthesizer once on mount
  useEffect(() => {
    engineSynthRef.current = new NinjaEngineSynth();
    return () => {
      engineSynthRef.current?.stop();
    };
  }, []);
  
  // High performance tracking variables to prevent stale closures in requestAnimationFrame
  const gameStateRef = useRef({
    status: 'idle' as RaceStatus,
    playerSpeed: 0, // km/h
    playerTargetSpeed: 0, // km/h
    playerSteeringY: 0,
    targetSteeringY: 0,
    stamina: 100,
    distanceTraveled: 0,
    trackXScroll: 0,
    lightAlignment: 100,
    settings: { ...settings },
    racers: [] as Racer[],
    opponentSpeeds: [215.5, 208.2, 198.8], // ultra-fast 399cc sportbike class targets
    lastFrameTime: 0,
    engineRpm: 1350,
    gear: 1,
    weather: 'clear' as 'clear' | 'rain',
    cameraAngle: 'cinematic' as 'cinematic' | 'low-angle' | 'warp',
    raytraced: true,
  });

  // Sync state to stateRef each changes
  useEffect(() => {
    gameStateRef.current.status = raceStatus;
    gameStateRef.current.settings = settings;
    gameStateRef.current.racers = racers;
    gameStateRef.current.stamina = stamina;
    gameStateRef.current.weather = weather;
    gameStateRef.current.cameraAngle = cameraAngle;
    gameStateRef.current.raytraced = raytraced;
  }, [raceStatus, settings, racers, stamina, weather, cameraAngle, raytraced]);

  // Continuous keyboard states tracking ref
  const keysPressedRef = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keysPressedRef.current[k] = true;
      setActiveKeysState(prev => prev[k] ? prev : { ...prev, [k]: true });
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key)) {
        e.preventDefault();
      }

      // Start the game if the user tries to accelerate when idle!
      if (gameStateRef.current.status === 'idle') {
        if (k === 'w' || e.key === 'ArrowUp') {
          startCountdown();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keysPressedRef.current[k] = false;
      setActiveKeysState(prev => {
        const copy = { ...prev };
        delete copy[k];
        return copy;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Update steering slowly for smooth lean angles matching requestAnimationFrame
  useEffect(() => {
    let frameId: number;
    const smoothSteer = () => {
      const current = playerSteeringY;
      const target = targetSteeringY;
      const diff = target - current;
      if (Math.abs(diff) > 0.1) {
        // Reduce quantum repulsor lateral stabilizing grip under rain: slow down steering responsiveness (slippery drift)
        const cornerGrip = gameStateRef.current.weather === 'rain' ? 0.078 : 0.14;
        const next = current + diff * cornerGrip;
        setPlayerSteeringY(next);
        gameStateRef.current.playerSteeringY = next;
      } else {
        setPlayerSteeringY(target);
        gameStateRef.current.playerSteeringY = target;
      }
      gameStateRef.current.targetSteeringY = target;
      frameId = requestAnimationFrame(smoothSteer);
    };
    frameId = requestAnimationFrame(smoothSteer);
    return () => cancelAnimationFrame(frameId);
  }, [playerSteeringY, targetSteeringY]);

  // Clock Update Effect (top status bar)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      setCurrentTime(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Pointer/Touch coordinates ref for frame-rate performance & preventing state closure stutters
  const pointerRef = useRef({
    isActive: false,
    x: 0,
    y: 0
  });

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (raceStatus !== 'racing') {
      if (raceStatus === 'idle') {
        startCountdown();
      }
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerRef.current.isActive = true;
    updatePointerSteering(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointerRef.current.isActive || raceStatus !== 'racing') return;
    updatePointerSteering(e);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointerRef.current.isActive = false;
    if (raceStatus === 'racing') {
      setTargetSteeringY(0);
    }
  };

  const updatePointerSteering = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    pointerRef.current.x = x;
    pointerRef.current.y = y;

    // Calculate alignment relative to center of the screen horizontally
    const centerX = canvas.width / 2;
    const offsetFromCenter = x - centerX;
    
    // Convert touch/drag horizontal offset into motorcycle steering range [-45 to +45]
    const calculatedSteering = Math.max(-45, Math.min(45, (offsetFromCenter / 160) * 45));
    setTargetSteeringY(calculatedSteering);
  };

  // Main Canvas with Starry beautiful Night Background, track, and dynamic follower light beam
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Canvas size management using ResizeObserver
    const handleResize = (entries: ResizeObserverEntry[]) => {
      for (let entry of entries) {
        if (entry.contentRect) {
          canvas.width = entry.contentRect.width;
          canvas.height = entry.contentRect.height;
        }
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Set initial size
    canvas.width = canvas.parentElement?.clientWidth || 800;
    canvas.height = canvas.parentElement?.clientHeight || 450;

    // Setup stars of the beautiful night sky
    const stars: Star[] = Array.from({ length: 150 }, () => ({
      x: Math.random() * canvas.width * 2,
      y: Math.random() * (canvas.height * 0.65),
      size: Math.random() * 2.2 + 0.6,
      opacity: Math.random() * 0.85 + 0.15,
      speed: Math.random() * 0.15 + 0.04,
    }));

    const particles: Particle[] = [];

    // Setup rain particles list
    const raindrops: { x: number; y: number; speedY: number; speedX: number; len: number; opacity: number }[] = [];
    const splashes: { x: number; y: number; radius: number; maxRadius: number; opacity: number; speed: number }[] = [];

    // Tracks horizontal wave calculations and volumetric mist scrolling
    let lightWaveOffset = 0;
    let fogOffset = 0;
    
    // Animation Loop
    let animationFrameId: number;
    let gameLoopTime = 0;

    const gameTick = (timestamp: number) => {
      const dt = timestamp - (gameStateRef.current.lastFrameTime || timestamp);
      gameStateRef.current.lastFrameTime = timestamp;

      // -----------------------------------------------------------
      // CONTINUOUS KEYBOARD INPUTS & ACCELERATION SPEED CHECK
      // -----------------------------------------------------------
      const keys = keysPressedRef.current;
      const baseSteerDelta = 2.6; // smooth responsive steering increment per frame

      if (gameStateRef.current.status === 'racing') {
        // Continuous keyboard WASD / Arrow Keys checking
        if (keys['w'] || keys['arrowup']) {
          gameStateRef.current.playerTargetSpeed = Math.min(gameStateRef.current.playerTargetSpeed + 1.25, 238);
        }
        if (keys['s'] || keys['arrowdown']) {
          gameStateRef.current.playerTargetSpeed = Math.max(gameStateRef.current.playerTargetSpeed - 3.2, 0);
        }
        // Premium Emergency Quantum Brake
        if (keys[' '] || keys['spacebar']) {
          gameStateRef.current.playerTargetSpeed = Math.max(gameStateRef.current.playerTargetSpeed - 5.5, 0);
        }

        let steered = false;
        if (keys['a'] || keys['arrowleft']) {
          setTargetSteeringY(y => Math.max(y - baseSteerDelta, -45));
          steered = true;
        }
        if (keys['d'] || keys['arrowright']) {
          setTargetSteeringY(y => Math.min(y + baseSteerDelta, 45));
          steered = true;
        }

        // Auto-center steering when steering keys are released for effortless perfect driving alignment
        if (!steered) {
          setTargetSteeringY(y => {
            if (y > 1.2) return Math.max(0, y - baseSteerDelta * 1.5);
            if (y < -1.2) return Math.min(0, y + baseSteerDelta * 1.5);
            return 0;
          });
        }

        // If mobile pointer/touch interaction is active, apply automatic continuous throttle boost!
        if (pointerRef.current.isActive) {
          gameStateRef.current.playerTargetSpeed = Math.min(gameStateRef.current.playerTargetSpeed + 1.1, 238);
          // Gently add stamina
          setStamina(s => Math.min(s + 0.1, 100));
        }
      }

      const playerSpeed = gameStateRef.current.playerSpeed;
      const targetSpeed = gameStateRef.current.playerTargetSpeed;
      
      // Decelerate or approach target speed gracefully
      let speedChange = (targetSpeed - playerSpeed) * 0.045;
      if (gameStateRef.current.weather === 'rain') {
        if (speedChange > 0) {
          speedChange *= 0.72; // reduced traction / wheel spin on accelerator (28% penalty)
        } else {
          speedChange *= 0.65; // longer braking distances under wet rain conditions
        }
      }
      gameStateRef.current.playerSpeed += speedChange;

      // Natural drag & speed decay of sportbike
      if (gameStateRef.current.status === 'racing') {
        gameStateRef.current.playerTargetSpeed = Math.max(gameStateRef.current.playerTargetSpeed - 0.22, 0);
      }

      // Add actual distance
      if (gameStateRef.current.status === 'racing') {
        const speedMps = gameStateRef.current.playerSpeed / 3.6;
        gameStateRef.current.distanceTraveled += (speedMps * (dt / 1000));
        gameStateRef.current.trackXScroll += gameStateRef.current.playerSpeed * 0.28;
      }

      const horizonX = canvas.width / 2;
      const horizonY = canvas.height * 0.42;

      // Update rain particle coordinates and splash ripples inside gameTick
      if (gameStateRef.current.weather === 'rain' && raindrops.length < 180) {
        for (let i = 0; i < 3; i++) {
          raindrops.push({
            x: Math.random() * canvas.width * 1.5 - canvas.width * 0.25,
            y: -25,
            speedY: Math.random() * 6 + 12,
            speedX: Math.random() * 2 - 4, // slanted rainfall
            len: Math.random() * 10 + 12,
            opacity: Math.random() * 0.40 + 0.15,
          });
        }
      }

      // Update rain drops
      for (let r = raindrops.length - 1; r >= 0; r--) {
        const drop = raindrops[r];
        drop.y += drop.speedY;
        drop.x += drop.speedX - (gameStateRef.current.playerSteeringY * 0.08);

        // Check if hit highway road boundary (below horizonY)
        if (drop.y > horizonY) {
          if (drop.x > 0 && drop.x < canvas.width && Math.random() < 0.45) {
            splashes.push({
              x: drop.x,
              y: drop.y + Math.random() * 5,
              radius: 1,
              maxRadius: Math.random() * 11 + 7,
              opacity: drop.opacity * 0.75,
              speed: Math.random() * 0.35 + 0.6,
            });
          }

          if (gameStateRef.current.weather === 'rain') {
            drop.y = -20;
            drop.x = Math.random() * canvas.width * 1.5 - canvas.width * 0.25;
          } else {
            raindrops.splice(r, 1);
          }
        }
      }

      // Update splashes
      for (let s = splashes.length - 1; s >= 0; s--) {
        const spl = splashes[s];
        spl.radius += spl.speed;
        spl.opacity -= 0.045;
        if (spl.opacity <= 0 || spl.radius >= spl.maxRadius) {
          splashes.splice(s, 1);
        }
      }

      // 1. Draw Starry Sky & Nebulae (Moody Cyberpunk Aesthetic, Crimson/Magenta Twilight)
      const isNight = gameStateRef.current.settings.isLowLightTheme;
      if (isNight) {
        // Deep space dark violet (Photorealistic premium black palette)
        ctx.fillStyle = '#020108';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Breathtaking evening twilight sky glow band touching the horizon
        const sunsetGrad = ctx.createLinearGradient(0, horizonY - 140, 0, horizonY);
        sunsetGrad.addColorStop(0, '#020108');
        sunsetGrad.addColorStop(0.2, '#0c0423'); // deep midnight violet
        sunsetGrad.addColorStop(0.5, '#2e0a4f'); // dark electric purple
        sunsetGrad.addColorStop(0.75, '#5e0b60'); // rich magenta
        sunsetGrad.addColorStop(0.92, '#ab0f5d'); // glowing neon rose
        sunsetGrad.addColorStop(1, '#ff055f'); // electric pink horizon line
        ctx.fillStyle = sunsetGrad;
        ctx.fillRect(0, horizonY - 140, canvas.width, 140);

        // Ambient Nebula Dreamy glow
        const nebGrad = ctx.createRadialGradient(canvas.width * 0.75, canvas.height * 0.18, 20, canvas.width * 0.75, canvas.height * 0.18, 400);
        nebGrad.addColorStop(0, 'rgba(217, 38, 98, 0.18)'); // vibrant hot pink nebula core
        nebGrad.addColorStop(0.4, 'rgba(124, 58, 237, 0.08)'); // neon violet bleed
        nebGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = nebGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Ultra-realistic cinematic crescent moon (Gilded with subtle peach/hot pink aura)
        ctx.save();
        const moonX = canvas.width * 0.82;
        const moonY = horizonY - 125;
        // Outer atmospheric glow
        const moonGlow = ctx.createRadialGradient(moonX, moonY, 1, moonX, moonY, 32);
        moonGlow.addColorStop(0, 'rgba(255, 15, 95, 0.28)');
        moonGlow.addColorStop(0.4, 'rgba(124, 58, 237, 0.08)');
        moonGlow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = moonGlow;
        ctx.beginPath();
        ctx.arc(moonX, moonY, 32, 0, Math.PI * 2);
        ctx.fill();

        // Gilded crescent body
        ctx.shadowColor = '#ff2c75';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#ffebf3';
        ctx.beginPath();
        ctx.arc(moonX, moonY, 12, 0, Math.PI * 2);
        ctx.fill();

        // Mask out base shadow for destination-out crescent carving
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = '#020108';
        ctx.beginPath();
        ctx.arc(moonX - 5, moonY - 2, 11.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Subtle digital net of neon skyline
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.012)';
        ctx.lineWidth = 1;
        for (let x = 0; x < canvas.width; x += 45) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, horizonY);
          ctx.stroke();
        }
      } else {
        // Serene twilight deep Indigo
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#020211');
        gradient.addColorStop(0.3, '#100624');
        gradient.addColorStop(0.6, '#4d0b3b');
        gradient.addColorStop(0.85, '#991b1b');
        gradient.addColorStop(1, '#ea580c');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Draw gorgeous, majestic drifting magenta and purple night clouds
      ctx.save();
      ctx.globalAlpha = 0.32;
      for (let i = 0; i < 7; i++) {
        const cloudX = ((canvas.width * i * 0.32) - (gameStateRef.current.trackXScroll * 0.03)) % (canvas.width * 1.5) - canvas.width * 0.25;
        const cloudY = horizonY - 45 - (i % 4) * 14;
        const cloudR = 48 + (i % 3) * 18;
        
        const cGrad = ctx.createRadialGradient(cloudX, cloudY, 5, cloudX, cloudY, cloudR);
        cGrad.addColorStop(0, '#ec4899'); // glowing hot pink edges
        cGrad.addColorStop(0.35, '#701a75'); // dark purple middle
        cGrad.addColorStop(0.7, '#1e1b4b'); // deep indigo-violet base
        cGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = cGrad;
        
        ctx.beginPath();
        ctx.arc(cloudX, cloudY, cloudR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // -----------------------------------------------------------
      // 3D RADIAL STARFIELD EXPANSION (Star-trails running out to viewer)
      // -----------------------------------------------------------
      stars.forEach((star) => {
        const speedRatio = (gameStateRef.current.playerSpeed + 12) / 240;
        
        let dx = star.x - horizonX;
        let dy = star.y - horizonY;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) dist = 1;

        // Move outwards
        const moveAmount = star.speed * speedRatio * 32.0;
        star.x += (dx / dist) * moveAmount;
        star.y += (dy / dist) * moveAmount;
        
        // Wrap stars when they hit screen borders or get too far
        if (star.x < 0 || star.x > canvas.width || star.y < 0 || star.y > canvas.height * 0.72) {
          const angle = Math.random() * Math.PI * 2;
          const startDist = Math.random() * 50 + 5;
          star.x = horizonX + Math.cos(angle) * startDist;
          star.y = horizonY + Math.sin(angle) * startDist;
        }

        const currentDist = Math.sqrt(Math.pow(star.x - horizonX, 2) + Math.pow(star.y - horizonY, 2));
        ctx.strokeStyle = isNight ? `rgba(232, 121, 249, ${star.opacity})` : `rgba(251, 191, 36, ${star.opacity})`; // pinkish stars
        ctx.lineWidth = star.size * (currentDist / 160 + 0.4);
        ctx.lineCap = 'round';
        ctx.beginPath();
        
        const stretchFactor = Math.min(3.2, 0.4 + speedRatio * 2.5);
        ctx.moveTo(star.x, star.y);
        ctx.lineTo(star.x - (dx / dist) * moveAmount * stretchFactor, star.y - (dy / dist) * moveAmount * stretchFactor);
        ctx.stroke();
      });

      // -----------------------------------------------------------
      // UNREAL ENGINE 5 CONFIGURATE HIGH-END CINEMATIC CAMERA
      // -----------------------------------------------------------
      const currentCameraMode = gameStateRef.current.cameraAngle;
      const curSpeed = gameStateRef.current.playerSpeed;
      const speedPct = curSpeed / 240.0;
      const rpmPct = gameStateRef.current.engineRpm / 16000.0;

      // Calculate organic spring-mass g-force inertia offsets:
      let camScale = 1.0;
      let camTranslateY = 0;
      let camTranslateX = 0;
      let camSwayAngle = 0;

      if (currentCameraMode === 'cinematic') {
        // Zoom out at high speed for field-of-view stretch
        camScale = 1.0 - speedPct * 0.085;
        // Shift camera down slightly as we accelerate to look forward on the road
        camTranslateY = speedPct * 18;
        // Parallax slide lag on steering input
        camTranslateX = -gameStateRef.current.playerSteeringY * 0.42;
        // Gentle organic sway reflecting road momentum
        camSwayAngle = Math.sin(timestamp * 0.0016) * 0.004;
      } else if (currentCameraMode === 'low-angle') {
        // Ground-level asphalt-level dramatic perspective
        camScale = 1.08;
        camTranslateY = -12;
        camTranslateX = -gameStateRef.current.playerSteeringY * 0.25;
        camSwayAngle = Math.sin(timestamp * 0.002) * 0.002;
      } else if (currentCameraMode === 'warp') {
        // Intense wide-angle telescope perspective
        camScale = 0.9 + speedPct * 0.04;
        camTranslateY = 32 - speedPct * 10;
        camTranslateX = -gameStateRef.current.playerSteeringY * 0.65;
        camSwayAngle = -gameStateRef.current.playerSteeringY * 0.0005 + (Math.random() - 0.5) * 0.003 * speedPct;
      }

      // Add camera vibration / engine shake under acceleration
      if (gameStateRef.current.status === 'racing') {
        const shakeIntensity = speedPct * 1.5 + (keysPressedRef.current['w'] ? 0.8 : 0);
        const shakeX = (Math.random() - 0.5) * shakeIntensity;
        const shakeY = (Math.random() - 0.5) * shakeIntensity;
        camTranslateX += shakeX;
        camTranslateY += shakeY;
      }

      ctx.save(); // -> OPEN UNREAL CAMERA context
      ctx.translate(canvas.width / 2, horizonY);
      ctx.scale(camScale, camScale);
      ctx.rotate(camSwayAngle);
      ctx.translate(-canvas.width / 2 + camTranslateX, -horizonY + camTranslateY);

      // -----------------------------------------------------------
      // DOUBLE-LAYERED CYBERPUNK METROPOLITAN SKYLINE (Layered high-rises with neon ads)
      // -----------------------------------------------------------
      ctx.save();
      const skylineShift = -gameStateRef.current.playerSteeringY * 0.65;
      const skylineXStart = horizonX - 520 + skylineShift;

      // Layer A: Distant silhouettes (Deep violet translucent)
      const distantTowers = [
        { w: 32, h: 55, xOff: -40 },
        { w: 45, h: 90, xOff: 30 },
        { w: 28, h: 74, xOff: 90 },
        { w: 50, h: 110, xOff: 160 },
        { w: 36, h: 68, xOff: 240 },
        { w: 40, h: 81, xOff: 310 },
        { w: 26, h: 50, xOff: 380 },
        { w: 42, h: 105, xOff: 440 },
        { w: 35, h: 60, xOff: 510 },
      ];
      ctx.fillStyle = '#0f0a28';
      distantTowers.forEach((t) => {
        ctx.fillRect(skylineXStart + t.xOff, horizonY - t.h, t.w, t.h);
      });

      // Massive floating Holo-Billboard Advertisements in the background
      ctx.globalCompositeOperation = 'screen';
      ctx.shadowBlur = 10;
      
      // Billboard A: Neon Triangle Display
      const holoX1 = skylineXStart + 110;
      const holoY1 = horizonY - 145;
      ctx.shadowColor = '#ec4899';
      ctx.strokeStyle = '#ec4899';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(holoX1, holoY1);
      ctx.lineTo(holoX1 + 14, holoY1 + 22);
      ctx.lineTo(holoX1 - 14, holoY1 + 22);
      ctx.closePath();
      ctx.stroke();
      ctx.strokeStyle = '#a855f7';
      ctx.strokeRect(holoX1 - 18, holoY1 + 25, 36, 4);

      // Billboard B: "NIGHT" Cyber panel
      const holoX2 = skylineXStart + 350;
      const holoY2 = horizonY - 120;
      ctx.shadowColor = '#06b6d4';
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.7)';
      ctx.strokeRect(holoX2, holoY2, 50, 15);
      ctx.fillStyle = '#22d3ee';
      ctx.font = 'bold 8.5px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('NIGHT', holoX2 + 25, holoY2 + 11);
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = 'source-over';

      // -----------------------------------------------------------
      // VOLUMETRIC METROPOLITAN SEARCHLIGHTS & FLYING DRONES (Unreal 5 sky)
      // -----------------------------------------------------------
      if (isNight) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        
        // 1. Megastructure Searchlights (Sweeping back and forth slowly)
        for (let sw = 0; sw < 3; sw++) {
          const bX = skylineXStart + 160 + sw * 130;
          const bY = horizonY - 14;
          const sweepAngle = Math.sin(timestamp * 0.00045 + sw * 2.2) * 0.35 - Math.PI / 2;
          
          const sGrad = ctx.createLinearGradient(bX, bY, bX + Math.cos(sweepAngle) * 280, bY + Math.sin(sweepAngle) * 280);
          sGrad.addColorStop(0, 'rgba(224, 242, 254, 0.16)');
          sGrad.addColorStop(0.5, 'rgba(34, 211, 238, 0.06)');
          sGrad.addColorStop(1, 'rgba(0,0,0,0)');
          
          ctx.fillStyle = sGrad;
          ctx.beginPath();
          ctx.moveTo(bX - 2.5, bY);
          ctx.lineTo(bX + Math.cos(sweepAngle - 0.02) * 280, bY + Math.sin(sweepAngle - 0.02) * 280);
          ctx.lineTo(bX + Math.cos(sweepAngle + 0.02) * 280, bY + Math.sin(sweepAngle + 0.02) * 280);
          ctx.lineTo(bX + 2.5, bY);
          ctx.closePath();
          ctx.fill();
        }

        // 2. Futuristic flying drone traffic light streaks
        for (let dr = 0; dr < 4; dr++) {
          const drX = ((skylineXStart + dr * 140 + timestamp * 0.06) % (canvas.width * 1.4)) - canvas.width * 0.2;
          const drY = horizonY - 120 + Math.sin(timestamp * 0.0012 + dr) * 12;
          ctx.fillStyle = dr % 2 === 0 ? '#ff007f' : '#00f0ff';
          ctx.beginPath();
          ctx.arc(drX, drY, 1.3, 0, Math.PI * 2);
          ctx.fill();
          
          // Symmetrical trailing light tail
          ctx.strokeStyle = dr % 2 === 0 ? 'rgba(255, 0, 127, 0.35)' : 'rgba(0, 240, 255, 0.35)';
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(drX, drY);
          ctx.lineTo(drX - 14, drY);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Layer B: Front massive detailed skyscrapers
      const towers = [
        { w: 32, h: 80, spire: true, color: '#090514' },
        { w: 50, h: 135, spire: true, color: '#0b0617', needle: true }, // The grand Needle Tower
        { w: 38, h: 72, spire: false, color: '#0e081e' },
        { w: 45, h: 95, spire: true, color: '#070412' },
        { w: 30, h: 58, spire: false, color: '#0a0616' },
        { w: 58, h: 112, spire: true, color: '#0c071a' },
        { w: 34, h: 86, spire: false, color: '#0d081f' },
        { w: 52, h: 102, spire: true, color: '#0a0515' },
        { w: 28, h: 63, spire: false, color: '#0e0921' },
        { w: 44, h: 85, spire: true, color: '#080413' },
      ];

      let currentX = skylineXStart;
      towers.forEach((t) => {
        // Draw tower body
        ctx.fillStyle = t.color;
        ctx.beginPath();
        ctx.fillRect(currentX, horizonY - t.h, t.w, t.h);

        // Tower spire accent needles
        if (t.spire) {
          ctx.strokeStyle = t.color;
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.moveTo(currentX + t.w / 2, horizonY - t.h);
          ctx.lineTo(currentX + t.w / 2, horizonY - t.h - 22);
          ctx.stroke();

          // Blinking red aviation warning dots
          if (Math.sin(timestamp * 0.007 + currentX) > 0.0) {
            ctx.fillStyle = '#ff1155';
            ctx.beginPath();
            ctx.arc(currentX + t.w / 2, horizonY - t.h - 22, 1.8, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Window grid rendering representing "thousands of lights" (Vibrant Pink & Neon Cyan palette)
        ctx.save();
        ctx.globalAlpha = 0.65 + Math.sin(timestamp * 0.0024 + currentX) * 0.28;
        const cols = Math.floor(t.w / 5.5);
        const rows = Math.floor(t.h / 11);
        for (let c = 1; c < cols; c++) {
          for (let r = 2; r < rows; r++) {
            const seed = Math.sin(currentX * 14 + c * 8 + r * 16);
            if (seed > -0.05) {
              // Custom neon windows: neon pink, neon cyan, electric purple, warm glowing white
              ctx.fillStyle = seed > 0.72 ? '#ff1177' : seed > 0.42 ? '#00e5ff' : seed > 0.15 ? '#bd93f9' : '#ffffff';
              ctx.fillRect(currentX + c * 5.5, horizonY - t.h + r * 10, 1.6, 1.6);
            }
          }
        }
        ctx.restore();

        currentX += t.w + 6;
      });
      ctx.restore();

      // Ambient mountain silhouettes
      const steerShift = gameStateRef.current.playerSteeringY * 0.45;
      ctx.fillStyle = isNight ? 'rgba(8, 4, 28, 0.35)' : 'rgba(20, 20, 58, 0.25)';
      ctx.beginPath();
      ctx.moveTo(0, canvas.height * 0.6);
      ctx.quadraticCurveTo(canvas.width * 0.2 - steerShift, canvas.height * 0.38, canvas.width * 0.45 - steerShift, canvas.height * 0.50);
      ctx.quadraticCurveTo(canvas.width * 0.7 - steerShift, canvas.height * 0.35, canvas.width - steerShift, canvas.height * 0.55);
      ctx.lineTo(canvas.width + 100, canvas.height);
      ctx.lineTo(-100, canvas.height);
      ctx.closePath();
      ctx.fill();

      // -----------------------------------------------------------
      // VOLUMETRIC NIGHT MIST / SCROLLING ATMOSPHERIC DEPTH LAYERS
      // -----------------------------------------------------------
      fogOffset += (gameStateRef.current.playerSpeed * 0.015);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = isNight ? `rgba(236, 72, 153, ${0.015 + j * 0.010})` : `rgba(99, 102, 241, 0.022)`; // dreamy pinkish neon fog
        const shiftX = (fogOffset * (j + 1)) % canvas.width;
        ctx.beginPath();
        ctx.moveTo(0, horizonY - 10);
        for (let ix = 0; ix <= canvas.width; ix += 45) {
          const waveHeight = Math.sin((ix + shiftX) * 0.01) * 8 + Math.cos(timestamp * 0.001) * 4;
          ctx.lineTo(ix, horizonY + 8 + waveHeight);
        }
        ctx.lineTo(canvas.width, canvas.height);
        ctx.lineTo(0, canvas.height);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // 2. Compute 3D highway perspective road pavement (Wider and more sweeping perspective)
      const roadWidthHorizon = 44;
      const roadWidthBottom = canvas.width * 1.35;
      
      const segments: { lx: number, rx: number, cx: number, y: number, w: number, p: number }[] = [];
      const steps = 30;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const p = Math.pow(t, 2.3); // exponential depth
        
        const yVal = horizonY + p * (canvas.height - horizonY);
        const roadW = roadWidthHorizon + (roadWidthBottom - roadWidthHorizon) * p;
        
        // Road centerline curves based on tracker wave offsets
        const pCurveFactor = Math.pow(p, 1.8);
        const roadCenterX = horizonX + Math.sin(lightWaveOffset + p * 3.4) * (canvas.width * 0.22) * pCurveFactor;
        
        segments.push({
          lx: roadCenterX - roadW / 2,
          rx: roadCenterX + roadW / 2,
          cx: roadCenterX,
          y: yVal,
          w: roadW,
          p: p
        });
      }

      // Draw asphalt highway road polygon with glossy rain-slicked wet look
      const roadGrad = ctx.createLinearGradient(horizonX, horizonY, horizonX, canvas.height);
      roadGrad.addColorStop(0, '#04030a'); // absolute black pitch near horizon
      roadGrad.addColorStop(1, '#0e0c19'); // glossy dark purple asphalt tone at screen base
      ctx.fillStyle = roadGrad;
      ctx.beginPath();
      ctx.moveTo(segments[0].lx, segments[0].y);
      for (let s = 1; s <= steps; s++) {
        ctx.lineTo(segments[s].lx, segments[s].y);
      }
      for (let s = steps; s >= 0; s--) {
        ctx.lineTo(segments[s].rx, segments[s].y);
      }
      ctx.closePath();
      ctx.fill();

      // Draw Neon Shoulder borders (Solid glowing ribbons)
      ctx.save();
      ctx.shadowBlur = 12;
      ctx.shadowColor = isNight ? '#ff007f' : '#6366f1'; // pink neon boundary
      
      // Left shoulder
      ctx.strokeStyle = isNight ? 'rgba(255, 0, 127, 0.85)' : 'rgba(99, 102, 241, 0.8)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(segments[0].lx, segments[0].y);
      for (let s = 1; s <= steps; s++) {
        ctx.lineTo(segments[s].lx, segments[s].y);
      }
      ctx.stroke();

      // Right shoulder
      ctx.strokeStyle = isNight ? 'rgba(255, 0, 127, 0.85)' : 'rgba(99, 102, 241, 0.8)';
      ctx.beginPath();
      ctx.moveTo(segments[0].rx, segments[0].y);
      for (let s = 1; s <= steps; s++) {
        ctx.lineTo(segments[s].rx, segments[s].y);
      }
      ctx.stroke();
      ctx.restore();

      // Draw two dashed lane divider lines (Symmetric 3-lane highway layout)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.26)';
      ctx.lineWidth = 2.2;
      const lineSpacing = 38;
      const scrollOffset = (gameStateRef.current.trackXScroll * 0.1) % lineSpacing;

      for (let s = 1; s < steps; s++) {
        const seg = segments[s];
        const nextSeg = segments[s+1 < steps ? s+1 : s];
        const cycle = Math.floor((seg.y + scrollOffset) / lineSpacing);
        if (cycle % 2 === 0) {
          // Left lane divider (1/3 of road width)
          const lx1 = seg.lx + (seg.rx - seg.lx) * 0.33;
          const nlx1 = nextSeg.lx + (nextSeg.rx - nextSeg.lx) * 0.33;
          ctx.beginPath();
          ctx.moveTo(lx1, seg.y);
          ctx.lineTo(nlx1, nextSeg.y);
          ctx.stroke();

          // Right lane divider (2/3 of road width)
          const rx1 = seg.lx + (seg.rx - seg.lx) * 0.67;
          const nrx1 = nextSeg.lx + (nextSeg.rx - nextSeg.lx) * 0.67;
          ctx.beginPath();
          ctx.moveTo(rx1, seg.y);
          ctx.lineTo(nrx1, nextSeg.y);
          ctx.stroke();
        }
      }

      // -----------------------------------------------------------
      // PERSPECTIVE STREET LIGHTS & WET HIGHWAY REFLECTION STREAKS
      // -----------------------------------------------------------
      // Create poles along left road edge that scroll past with cybernetic alternating pink/cyan lights!
      const lampPitch = 120;
      const lampOffset = (gameStateRef.current.trackXScroll * 0.12) % lampPitch;
      
      ctx.save();
      for (let s = 2; s < steps; s += 5) {
        const seg = segments[s];
        const currentP = seg.p;
        
        // Generate street pole curving out matching current perspective step
        const lampH = 85 * currentP;
        const poleX = seg.lx - 12 * currentP;
        const lampX = seg.lx + 24 * currentP;
        const lampY = seg.y - lampH;
        
        // Pole curve drawing
        ctx.strokeStyle = '#110c22';
        ctx.lineWidth = 3.8 * currentP + 0.6;
        ctx.beginPath();
        ctx.moveTo(poleX, seg.y);
        ctx.quadraticCurveTo(poleX - 5 * currentP, lampY, lampX, lampY);
        ctx.stroke();
        
        // Cyber streetlight color: alternate between glowing pink and vibrant cyan
        const isPinkLamp = (s % 10 < 5);
        const lampHex = isPinkLamp ? '#ff007f' : '#00f0ff';
        const lampDimHex = isPinkLamp ? 'rgba(255, 0, 127, 0.6)' : 'rgba(0, 240, 255, 0.6)';
        
        // Glowing streetlight head
        const lightGlow = ctx.createRadialGradient(lampX, lampY, 1 * currentP + 0.1, lampX, lampY, 30 * currentP);
        lightGlow.addColorStop(0, '#ffffff'); // bright core
        lightGlow.addColorStop(0.3, lampDimHex);
        lightGlow.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = lightGlow;
        ctx.beginPath();
        ctx.arc(lampX, lampY, 30 * currentP, 0, Math.PI * 2);
        ctx.fill();
        
        // -----------------------------------------------------------
        // WET PAVEMENT EXTRACTION REFLECTIONS (Vertical linear glowing reflection streaks)
        // -----------------------------------------------------------
        ctx.globalCompositeOperation = 'screen';
        const streakW = 16 * currentP + 4;
        const streakH = canvas.height - seg.y;
        
        const streakColor = ctx.createLinearGradient(lampX, seg.y, lampX, canvas.height);
        streakColor.addColorStop(0, isPinkLamp ? 'rgba(255, 0, 127, 0.45)' : 'rgba(0, 240, 255, 0.45)'); // super saturated reflect
        streakColor.addColorStop(0.4, isPinkLamp ? 'rgba(255, 0, 127, 0.18)' : 'rgba(0, 240, 255, 0.18)');
        streakColor.addColorStop(1, 'rgba(0, 0, 0, 0.0)');  // Fade out
        
        ctx.fillStyle = streakColor;
        ctx.beginPath();
        ctx.ellipse(lampX, (seg.y + canvas.height) / 2, streakW, streakH / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // -----------------------------------------------------------
      // REAL-TIME HIGH-FIDELITY "RAY-TRACED" WET SURFACE REFLECTIONS (Cyberpunk wet asphalt)
      // -----------------------------------------------------------
      if (gameStateRef.current.raytraced) {
        const skylineShiftLocal = -gameStateRef.current.playerSteeringY * 0.65;
        const skylineXStartLocal = horizonX - 520 + skylineShiftLocal;

        // We trace mirror columns of the prominent skyscrapers above onto the slick wet asphalt!
        // Skyscraper columns: Pink (#ff1177), Cyan (#00e5ff), Purple (#bd93f9)
        const reflectionColumns = [
          { xShift: 110, w: 42, color: 'rgba(236, 72, 153, 0.15)', hOffset: 120 }, // Billboard Display pink shimmer
          { xShift: 240, w: 32, color: 'rgba(124, 58, 237, 0.12)', hOffset: 80 },  // Violet spire reflect
          { xShift: 350, w: 48, color: 'rgba(6, 182, 212, 0.16)', hOffset: 135 },  // "NIGHT" cyanshift
          { xShift: 480, w: 35, color: 'rgba(168, 85, 247, 0.14)', hOffset: 95 }   // purple city blocks
        ];

        reflectionColumns.forEach(col => {
          const colX = skylineXStartLocal + col.xShift;
          const isRainy = gameStateRef.current.weather === 'rain';
          // Rain drops distort reflections with dynamic phase shifting
          const shiftRipple = isRainy ? Math.sin(timestamp * 0.015 + colX) * 4.2 : 0;
          const finalW = col.w + shiftRipple;
          
          // Create reflection gradient flaring out downwards on wet road
          const refGrad = ctx.createLinearGradient(colX, horizonY, colX + shiftRipple, canvas.height);
          refGrad.addColorStop(0, col.color);
          refGrad.addColorStop(0.3, col.color.replace('0.15', '0.08').replace('0.12', '0.06').replace('0.16', '0.09').replace('0.14', '0.07'));
          refGrad.addColorStop(1, 'rgba(0,0,0,0)');
          
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.fillStyle = refGrad;
          
          // Cast column along perspective segments
          ctx.beginPath();
          ctx.moveTo(colX - finalW/2, horizonY);
          ctx.lineTo(colX + shiftRipple - finalW * 1.6, canvas.height);
          ctx.lineTo(colX + shiftRipple + finalW * 1.6, canvas.height);
          ctx.lineTo(colX + finalW/2, horizonY);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        });

        // Ray-traced mirror reflection of the motorcycle itself!
        // We project a beautifully blurred inverted column of the EV-X immediately trailing from the touch-down point on wet asphalt
        const playerBaseSeg = segments[25];
        const pReflectX = playerBaseSeg.cx + (gameStateRef.current.playerSteeringY * 4.8);
        const pReflectY = playerBaseSeg.y;
        
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        
        // Dynamic water surface distortion ripples on the bike's reflective underglow
        const isRainyActive = gameStateRef.current.weather === 'rain';
        const rippleX = isRainyActive ? Math.sin(timestamp * 0.024) * 2.8 : 0;
        
        const activeUnderglow = gameStateRef.current.lightAlignment > 80;
        const engineRefColor = activeUnderglow ? 'rgba(0, 240, 255, 0.38)' : 'rgba(255, 0, 127, 0.32)';
        
        const reflectY = pReflectY + 20;
        const reflexH = 75;
        const motorRefGrad = ctx.createLinearGradient(pReflectX, reflectY, pReflectX + rippleX, reflectY + reflexH);
        motorRefGrad.addColorStop(0, engineRefColor);
        motorRefGrad.addColorStop(0.4, 'rgba(168, 85, 247, 0.16)'); // purple twilight bleed
        motorRefGrad.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.fillStyle = motorRefGrad;
        ctx.beginPath();
        ctx.ellipse(pReflectX + rippleX/2, reflectY + reflexH/2, 28, reflexH/2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Dual hot pink laser exhausts reflections
        const nozzles = [-23, 23];
        nozzles.forEach(nozzleX => {
          const nzX = pReflectX + nozzleX;
          const nzGrad = ctx.createLinearGradient(nzX, reflectY, nzX + rippleX, reflectY + 45);
          nzGrad.addColorStop(0, 'rgba(255, 0, 127, 0.35)');
          nzGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = nzGrad;
          ctx.beginPath();
          ctx.ellipse(nzX + rippleX/2, reflectY + 22, 10, 22, 0, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();
      } else {
        // Standard metropolitan window reflections onto the wet center asphalt!
        const skylineShiftLocal = -gameStateRef.current.playerSteeringY * 0.65;
        for (let rxRef = 0.25; rxRef <= 0.75; rxRef += 0.18) {
          const refX = canvas.width * rxRef + (skylineShiftLocal * 0.4);
          const refW = 28 + (gameStateRef.current.playerSpeed * 0.1);
          const refGrad = ctx.createLinearGradient(refX, horizonY, refX, canvas.height);
          const refColor = rxRef < 0.4 ? 'rgba(255,0,127,0.06)' : rxRef < 0.6 ? 'rgba(0,240,255,0.06)' : 'rgba(189,147,249,0.06)';
          refGrad.addColorStop(0, refColor);
          refGrad.addColorStop(0.8, 'rgba(0,0,0,0)');
          ctx.fillStyle = refGrad;
          ctx.fillRect(refX - refW / 2, horizonY, refW, canvas.height - horizonY);
        }
      }

      // High-speed motion blur lines scoring past road flanks
      if (gameStateRef.current.playerSpeed > 40) {
        ctx.globalCompositeOperation = 'screen';
        ctx.strokeStyle = 'rgba(255, 0, 127, 0.15)';
        ctx.lineWidth = 1.5;
        // speed streaks
        for (let m = 0; m < 5; m++) {
          const streakSegIndex = Math.floor((timestamp * 0.04 + m * 6) % 28) + 1;
          const sSeg = segments[streakSegIndex];
          const offsetLeftX = sSeg.lx + 45 * sSeg.p;
          const offsetRightX = sSeg.rx - 45 * sSeg.p;
          const len = 35 * sSeg.p;
          
          ctx.beginPath();
          ctx.moveTo(offsetLeftX, sSeg.y);
          ctx.lineTo(offsetLeftX + (Math.sin(m * 17) * 4), sSeg.y + len);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(offsetRightX, sSeg.y);
          ctx.lineTo(offsetRightX + (Math.sin(m * 23) * 4), sSeg.y + len);
          ctx.stroke();
        }
      }
      ctx.restore();

      // Core Dynamic neon lightwave pathway (represented in 3D lane depth)
      lightWaveOffset += (0.015 + (gameStateRef.current.playerSpeed * 0.0004));
      const lightBeamAmplitude = 0.32; // maximum displacement %
      
      const neonPathPoints: { x: number, y: number, w: number, p: number }[] = [];
      let targetTrackXOfPlayer = horizonX; // optimal center target at player's depth

      for (let s = 0; s <= steps; s++) {
        const seg = segments[s];
        const laneShift = Math.sin(lightWaveOffset + seg.p * 3.8) * lightBeamAmplitude;
        const neonX = seg.cx + laneShift * seg.w;
        
        neonPathPoints.push({ x: neonX, y: seg.y, w: seg.w, p: seg.p });

        // Player sits around s = 25 (depth ~0.82)
        if (s === 25) {
          targetTrackXOfPlayer = neonX;
        }
      }

      // Draw neon tracker curve
      ctx.shadowBlur = 18;
      ctx.shadowColor = isNight ? '#22d3ee' : '#818cf8';
      
      const lightPathGradient = ctx.createLinearGradient(0, horizonY, 0, canvas.height);
      if (isNight) {
        lightPathGradient.addColorStop(0, 'rgba(34, 211, 238, 0.1)');
        lightPathGradient.addColorStop(0.5, 'rgba(6, 182, 212, 0.85)');
        lightPathGradient.addColorStop(1, 'rgba(16, 185, 129, 0.95)');
      } else {
        lightPathGradient.addColorStop(0, 'rgba(129, 140, 248, 0.1)');
        lightPathGradient.addColorStop(0.5, 'rgba(99, 102, 241, 0.7)');
        lightPathGradient.addColorStop(1, 'rgba(129, 140, 248, 0.9)');
      }

      ctx.strokeStyle = lightPathGradient;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(neonPathPoints[0].x, neonPathPoints[0].y);
      for (let s = 1; s <= steps; s++) {
        ctx.lineTo(neonPathPoints[s].x, neonPathPoints[s].y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw wet puddle splash ripples on the road asphalt
      ctx.save();
      splashes.forEach(spl => {
        ctx.strokeStyle = `rgba(168, 230, 255, ${spl.opacity})`;
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        // Symmetrical flat ellipse for 3D perspective depth on pavement
        ctx.ellipse(spl.x, spl.y, spl.radius * 1.3, spl.radius * 0.38, 0, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.restore();

      // Position player relative to curving road center segment
      const playerBaseSeg = segments[25];
      const playerRenderX = playerBaseSeg.cx + (gameStateRef.current.playerSteeringY * 4.8);
      const playerActualY = playerBaseSeg.y;

      // Update alignment metrics
      const deviation = Math.abs(playerRenderX - targetTrackXOfPlayer);
      const alignmentScore = Math.max(0, Math.min(100, Math.round(100 - (deviation / 130) * 100)));
      gameStateRef.current.lightAlignment = alignmentScore;

      // Motorcycle gear shift & engine RPM simulation
      let speed = gameStateRef.current.playerSpeed;
      let gear = 1;
      let rpm = 1350;

      if (speed > 5) {
        const rpmPerGearSpeedRatio = 40; 
        gear = Math.min(6, Math.floor(speed / rpmPerGearSpeedRatio) + 1);
        const speedInGear = speed - (gear - 1) * rpmPerGearSpeedRatio;
        rpm = Math.min(15800, 3000 + (speedInGear / rpmPerGearSpeedRatio) * 11500 + Math.sin(timestamp * 0.02) * 50);
      } else {
        rpm = 1350 + Math.sin(timestamp * 0.04) * 35;
      }

      gameStateRef.current.gear = gear;
      gameStateRef.current.engineRpm = Math.round(rpm);

      if (gameLoopTime % 10 === 0) {
        setPlayerGear(gear);
        setPlayerRpm(Math.round(rpm));
      }

      // Handle alignment rewards
      if (gameStateRef.current.status === 'racing') {
        if (alignmentScore > 82) {
          setStamina(s => Math.min(s + 0.15, 100));
          gameStateRef.current.playerTargetSpeed = Math.min(gameStateRef.current.playerTargetSpeed + 0.35, 240);
        } else if (alignmentScore < 45) {
          setStamina(s => Math.max(s - 0.08, 12));
          gameStateRef.current.playerTargetSpeed = Math.max(gameStateRef.current.playerTargetSpeed - 0.18, 20);
        }

        // Update racers
        gameStateRef.current.racers = gameStateRef.current.racers.map(r => {
          if (r.isPlayer) {
            return {
              ...r,
              speed: gameStateRef.current.playerSpeed,
              distance: gameStateRef.current.distanceTraveled,
              lightAlignment: alignmentScore,
              engineRpm: Math.round(rpm)
            };
          } else {
            const index = r.id === 'racer_1' ? 0 : r.id === 'racer_2' ? 1 : 2;
            const baseSpd = gameStateRef.current.opponentSpeeds[index];
            const fluctuations = Math.sin(timestamp * 0.0016 + index * 5) * 12;
            const liveSpd = Math.max(80, baseSpd + fluctuations);
            const deltaM = (liveSpd / 3.6) * (dt / 1000);

            return {
              ...r,
              speed: liveSpd,
              distance: Math.min(r.distance + deltaM, gameStateRef.current.settings.totalDistance),
              engineRpm: Math.round(11000 + fluctuations * 250),
            };
          }
        });

        // -----------------------------------------------------------
        // DYNAMIC RACING COMMENTATOR - MID-RACE HIGHLIGHT TRIGGERS
        // -----------------------------------------------------------
        const sortedCurrentRacers = [...gameStateRef.current.racers].sort((a,b) => b.distance - a.distance);
        const playerLiveRank = sortedCurrentRacers.findIndex(rd => rd.isPlayer) + 1;
        const totalRacerCount = sortedCurrentRacers.length;

        // Rank Shift Commentator Triggers (Only trigger if state changed, ignore if initial frame 0 setup)
        if (commentatorStateRef.current.currentPostRank !== playerLiveRank && commentatorStateRef.current.currentPostRank !== 0) {
          if (playerLiveRank < commentatorStateRef.current.currentPostRank) {
            // Player climbs rank / overtakes!
            if (timestamp - commentatorStateRef.current.lastRankUpTime > 4200) {
              const climbQuotes = [
                `Superb overtake! ZX-Custom climbs into rank P${playerLiveRank} of ${totalRacerCount}!`,
                `Slicing past the competition! Direct overtake into position P${playerLiveRank}!`,
                `Awesome speedway sync! Slicing through slipstreams to secure P${playerLiveRank}!`,
                `Dynamic power delivery! Rider reclaims position P${playerLiveRank}!`
              ];
              triggerCommentaryRef.current(climbQuotes[Math.floor(Math.random() * climbQuotes.length)], 'rank');
              commentatorStateRef.current.lastRankUpTime = timestamp;
            }
          } else {
            // Player falls behind in rank!
            if (timestamp - commentatorStateRef.current.lastRankDownTime > 4200) {
              const dropQuotes = [
                `Watch out! Slipping back to rank P${playerLiveRank}!`,
                `Slipstream failure! Competitors are drafting past our rear guard!`,
                `Lost position! Reeled back to rank P${playerLiveRank}! Twist that throttle!`
              ];
              triggerCommentaryRef.current(dropQuotes[Math.floor(Math.random() * dropQuotes.length)], 'rank');
              commentatorStateRef.current.lastRankDownTime = timestamp;
            }
          }
        }
        commentatorStateRef.current.currentPostRank = playerLiveRank;

        // Top Velocity Check
        if (gameStateRef.current.playerSpeed >= 234.0) {
          if (timestamp - commentatorStateRef.current.lastTopSpeedTime > 8500) {
            const speedQuotes = [
              `Extreme velocity! Cheating the drag field at a blistering ${Math.round(gameStateRef.current.playerSpeed)} km/h!`,
              `Inline-4 has reached peak tachometer redline! Hold on tight, rider!`,
              `Absolute terminal velocity reached! The asphalt is a neon blur!`
            ];
            triggerCommentaryRef.current(speedQuotes[Math.floor(Math.random() * speedQuotes.length)], 'speed');
            commentatorStateRef.current.lastTopSpeedTime = timestamp;
          }
        }

        // Perfect light bar sync feedback comments
        if (alignmentScore > 86 && timestamp - commentatorStateRef.current.lastRedlineTime > 12000) {
          const syncQuotes = [
            `Incredible alignment! Achieving 90%+ streamline light beam coupling!`,
            `Headlight locked right down the track! Energy capacitor: fully synced!`,
            `Beautiful harmony with the light field! Inline-4 is howling in perfect synergy!`
          ];
          triggerCommentaryRef.current(syncQuotes[Math.floor(Math.random() * syncQuotes.length)], 'redline');
          commentatorStateRef.current.lastRedlineTime = timestamp;
        }
      }

      // Audio engine
      if (!isAudioMuted && gameStateRef.current.status === 'racing') {
        engineSynthRef.current?.start();
        engineSynthRef.current?.update(rpm, alignmentScore);
      } else {
        engineSynthRef.current?.stop();
      }

      // Exhaust Spark smoke particles
      if (gameStateRef.current.status === 'racing' && gameStateRef.current.playerSpeed > 10) {
        if (Math.random() < 0.42) {
          particles.push({
            x: playerRenderX + 16 + (Math.random() - 0.5) * 4,
            y: playerActualY + 6,
            vx: (Math.random() - 0.5) * 2,
            vy: 2 + Math.random() * 3, // floating backward
            alpha: 1.0,
            size: Math.random() * 2.8 + 1.2,
            color: alignmentScore > 80 ? '#00f0ff' : 'rgba(239, 68, 68, 0.82)'
          });
        }
      }

      particles.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.032;
        p.size += 0.12; // expanding 3D size as they approach the screen foreground
        if (p.alpha <= 0) {
          particles.splice(idx, 1);
          return;
        }
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      });

      // Active alignment underglow (neon coupling aura underneath repulsor thrust field contacting pavement)
      ctx.save();
      const underglowRadius = 55 + Math.sin(timestamp * 0.012) * 6 + (rpm / 16000) * 10;
      const activeUnderglow = ctx.createRadialGradient(
        playerRenderX, playerActualY + 18, 2, 
        playerRenderX, playerActualY + 18, underglowRadius
      );
      
      if (alignmentScore > 82) {
        activeUnderglow.addColorStop(0, 'rgba(34, 197, 94, 0.7)'); // Perf lime
        activeUnderglow.addColorStop(0.4, 'rgba(6, 182, 212, 0.25)');
        activeUnderglow.addColorStop(1, 'rgba(0,0,0,0)');
      } else if (alignmentScore > 45) {
        activeUnderglow.addColorStop(0, 'rgba(251, 191, 36, 0.5)'); // Gold alignment
        activeUnderglow.addColorStop(0.5, 'rgba(251, 191, 36, 0.15)');
        activeUnderglow.addColorStop(1, 'rgba(0,0,0,0)');
      } else {
        activeUnderglow.addColorStop(0, 'rgba(239, 68, 68, 0.6)'); // Warning drift
        activeUnderglow.addColorStop(0.5, 'rgba(239, 68, 68, 0.2)');
        activeUnderglow.addColorStop(1, 'rgba(0,0,0,0)');
      }

      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = activeUnderglow;
      ctx.beginPath();
      ctx.arc(playerRenderX, playerActualY + 18, underglowRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // -----------------------------------------------------------
      // FORWARD LIGHTING FLARE (Headlight beam cone casting forward on the road ahead)
      // -----------------------------------------------------------
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const headlightIntensity = 0.55 + (gameStateRef.current.engineRpm / 16000) * 0.45;
      const lightX = playerRenderX;
      const lightY = playerActualY - 14; // project from handles/fairing forward
      
      const coneGradient = ctx.createLinearGradient(0, lightY, 0, horizonY);
      if (isNight) {
        coneGradient.addColorStop(0, `rgba(224, 242, 254, ${0.35 * headlightIntensity})`); // bright white cone
        coneGradient.addColorStop(1, 'rgba(6, 182, 212, 0)');
      } else {
        coneGradient.addColorStop(0, `rgba(224, 242, 254, ${0.25 * headlightIntensity})`);
        coneGradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
      }
      
      ctx.fillStyle = coneGradient;
      ctx.beginPath();
      ctx.moveTo(lightX - 8, lightY);
      ctx.lineTo(lightX - 45, horizonY + 20);
      ctx.lineTo(lightX + 45, horizonY + 20);
      ctx.lineTo(lightX + 8, lightY);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Draw Sleek Contact Shadow under speedometer/cockpit shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(playerRenderX, canvas.height, 90, 18, 0, 0, Math.PI * 2);
      ctx.fill();

      // -----------------------------------------------------------
      // 3D HIGH-POLISHED THIRD-PERSON VEHICLE (CYBERPUNK GLOSSY ULTRA-DETAILED RACE BIKE)
      // -----------------------------------------------------------
      ctx.save();
      // Center the bike horizontally on playerRenderX, near the bottom of the canvas
      const bikeY = canvas.height - 60;
      ctx.translate(playerRenderX, bikeY);

      // Handle roll angle during steering lean (disabled as per user request to keep the bike perfectly level/upright):
      const leanAngle = 0;
      ctx.rotate(leanAngle);

      // Scale model for majestic, clear visibility
      const bikeScale = 1.35;
      ctx.scale(bikeScale, bikeScale);

      // 1. Ground Contact Shadow & Neon Underglow
      const shadowGlow = ctx.createRadialGradient(0, 18, 1, 0, 18, 52);
      shadowGlow.addColorStop(0, 'rgba(255, 0, 127, 0.45)'); // Pink underglow core
      shadowGlow.addColorStop(0.35, 'rgba(168, 85, 247, 0.18)'); // Soft purple ambient spill
      shadowGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = shadowGlow;
      ctx.beginPath();
      ctx.ellipse(0, 18, 48, 11, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
      ctx.beginPath();
      ctx.ellipse(0, 18, 28, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. Glowing Quantum Repulsor Hover Module (Wheel-less Levitation Drive)
      // Since the wheel is removed, we draw a brilliant levitational propulsion core with an integrated quantum gravity coil.
      const throttleActive = keysPressedRef.current['w'] || keysPressedRef.current['arrowup'] || keysPressedRef.current['W'] || keysPressedRef.current['ArrowUp'];
      const hoverPulse = Math.sin(timestamp * 0.08) * 1.8;
      
      // Floating Levitational Propulsion Rings
      ctx.save();
      ctx.translate(0, 3 + hoverPulse); // subtle core hovering float animation

      // Draw the main repulsor emitter shell (The mechanical outer casing)
      const casingGrad = ctx.createLinearGradient(-18, -14, 18, 14);
      casingGrad.addColorStop(0, '#1e293b');
      casingGrad.addColorStop(0.5, '#0f172a');
      casingGrad.addColorStop(1, '#020617');
      ctx.fillStyle = casingGrad;
      ctx.beginPath();
      ctx.roundRect(-18, -14, 36, 28, 8);
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw inner superconducting levitation coil (glowing electric-blue ring)
      ctx.save();
      ctx.shadowBlur = throttleActive ? 22 : 12;
      ctx.shadowColor = '#00f0ff';
      
      const coilGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, 11);
      coilGrad.addColorStop(0, '#00f0ff');
      coilGrad.addColorStop(0.5, '#0369a1');
      coilGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = coilGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();

      // Spinning flux segments inside the reactor core to denote active power
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.0;
      const fluxRotation = (timestamp * (throttleActive ? 0.18 : 0.06)) % (Math.PI * 2);
      for (let s = 0; s < 4; s++) {
        const segAngle = fluxRotation + s * (Math.PI / 2);
        ctx.beginPath();
        ctx.arc(0, 0, 7.5, segAngle, segAngle + 0.5);
        ctx.stroke();
      }

      // Center magnetic stabilizer hub
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Translucent magnetic containment energy shield encircling the drive
      ctx.strokeStyle = throttleActive ? 'rgba(0, 240, 255, 0.45)' : 'rgba(0, 240, 255, 0.22)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.stroke();

      // Symmetrical neon emitter charging nodes
      const nodeColors = ['#ff007f', '#00f0ff'];
      for (let nd = 0; nd < 4; nd++) {
        const nAngle = nd * (Math.PI / 2) + (timestamp * 0.02);
        const ndX = Math.cos(nAngle) * 14;
        const ndY = Math.sin(nAngle) * 14;
        ctx.fillStyle = nodeColors[nd % 2];
        ctx.beginPath();
        ctx.arc(ndX, ndY, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Downward repulsion thrust beams hitting the road
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.shadowBlur = throttleActive ? 30 : 15;
      ctx.shadowColor = '#00f0ff';
      const thrustGrad = ctx.createLinearGradient(0, 10, 0, 36);
      thrustGrad.addColorStop(0, throttleActive ? 'rgba(0, 240, 255, 0.85)' : 'rgba(0, 240, 255, 0.42)');
      thrustGrad.addColorStop(0.4, throttleActive ? 'rgba(165, 56, 248, 0.6)' : 'rgba(165, 56, 248, 0.28)');
      thrustGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = thrustGrad;

      // Draw flared propulsion cone down onto pavement
      ctx.beginPath();
      ctx.moveTo(-12, 10);
      ctx.lineTo(-32, 38);
      ctx.lineTo(32, 38);
      ctx.lineTo(12, 10);
      ctx.closePath();
      ctx.fill();

      // Ground energy ripple waves below the hover module
      ctx.strokeStyle = throttleActive ? 'rgba(0, 240, 255, 0.75)' : 'rgba(0, 240, 255, 0.38)';
      ctx.lineWidth = 1.8;
      for (let w = 0; w < 3; w++) {
        const ripplePhase = (timestamp * (throttleActive ? 0.22 : 0.11) + w * 12) % 36;
        const ripY = 22 + ripplePhase * 0.45;
        const ripW = 12 + ripplePhase * 1.5;
        ctx.beginPath();
        // Symmetrical flat ellipse for 3D perspective depth on pavement
        ctx.ellipse(0, ripY, ripW, ripY * 0.18, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // 3. Exposed Electromagnetic Sprocket Assembly (Gold/Carbon linkages)
      ctx.save();
      ctx.translate(-14, 4);
      ctx.fillStyle = '#1e1b4b'; // deep metal sprocket backing
      ctx.beginPath();
      ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = '#d97706'; // Golden machined drive teeth
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.stroke();

      // Drive connection cabling / links
      ctx.fillStyle = '#312e81';
      ctx.fillRect(-1, -11, 2, 7);
      ctx.restore();

      // 4. Brushed Titanium Dual Stabilizer Spars & Magnetic Flow Coolers
      const swingArmGrad = ctx.createLinearGradient(-19, -24, 19, -2);
      swingArmGrad.addColorStop(0, '#0a090e');
      swingArmGrad.addColorStop(0.5, '#24222c'); // silver-grey titanium tone
      swingArmGrad.addColorStop(1, '#020104');
      ctx.fillStyle = swingArmGrad;
      ctx.beginPath();
      ctx.roundRect(-19, -24, 7, 22, 2.5);
      ctx.roundRect(12, -24, 7, 22, 2.5);
      ctx.fill();

      // Neon-cooled magnetic flux cooling valves
      ctx.fillStyle = '#ff0055';
      ctx.beginPath();
      ctx.roundRect(13.5, -6, 4.5, 10, 1.2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(15, -3, 2, 4);

      // 5. High-Tech Hybrid EV Engine Core Block, Titanium Exhaust Headers & Trellis Spaceframe
      // A. Engine block drawn underneath trellis frame
      ctx.save();
      ctx.fillStyle = '#0f1016'; // deep carbon grey crankcase
      ctx.beginPath();
      ctx.roundRect(-15, -42, 30, 24, 4);
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Circular stator coil starter housing
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(-4, -30, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.stroke();

      // Miniature alloy hex bolts on stator cover
      ctx.fillStyle = '#cbd5e1';
      for (let b = 0; b < 6; b++) {
        const bAngle = b * (Math.PI * 2 / 6);
        ctx.beginPath();
        ctx.arc(-4 + Math.cos(bAngle) * 5.8, -30 + Math.sin(bAngle) * 5.8, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Copper induction windings detailing (Gleaming gold lines inside motor vents)
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      for (let wX = -10; wX <= 10; wX += 3) {
        ctx.moveTo(wX, -40);
        ctx.lineTo(wX, -34);
      }
      ctx.stroke();

      // Cylinder head metallic cooling fins
      ctx.fillStyle = '#0b090e';
      ctx.fillRect(-12, -43, 24, 2.5);
      ctx.fillStyle = '#475569';
      ctx.fillRect(-13, -45, 26, 1.2);
      ctx.fillRect(-11, -47, 22, 1.2);

      // Bioluminescent neon active coolant cables
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(6, -26);
      ctx.bezierCurveTo(8, -21, 12, -23, 14, -19);
      ctx.stroke();
      ctx.restore();

      // B. Semicircular Iridescent Blue-Anodized Exhaust Headers
      ctx.save();
      const headerGrad = ctx.createLinearGradient(-10, -42, -20, -18);
      headerGrad.addColorStop(0, '#1e293b'); // steel grey connector
      headerGrad.addColorStop(0.3, '#4f46e5'); // deep indigo-violet heat transition
      headerGrad.addColorStop(0.75, '#06b6d4'); // anodized titanium electric-cyan
      headerGrad.addColorStop(1, '#ff007f'); // white-pink tip
      ctx.strokeStyle = headerGrad;
      ctx.lineWidth = 1.85;
      ctx.lineJoin = 'round';
      
      // Symmetrical left manifold curve
      ctx.beginPath();
      ctx.moveTo(-6, -41);
      ctx.bezierCurveTo(-14, -39, -17, -29, -23, -22);
      ctx.stroke();

      // Symmetrical right manifold curve
      ctx.beginPath();
      ctx.moveTo(6, -41);
      ctx.bezierCurveTo(14, -39, 18, -29, 23, -22);
      ctx.stroke();
      ctx.restore();

      // C. Exposed Steel Trellis Structural Pipes (Overlaid on top of motor)
      ctx.strokeStyle = '#ff007f'; // Hot pink trellis structural tubes
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-16, -42);
      ctx.lineTo(0, -32);
      ctx.lineTo(16, -42);
      ctx.moveTo(-10, -38);
      ctx.lineTo(-10, -20);
      ctx.moveTo(10, -38);
      ctx.lineTo(10, -20);
      ctx.stroke();

      // Central Hydraulic Shock Absorber unit with neon spring coil
      ctx.strokeStyle = '#181424';
      ctx.lineWidth = 5.5;
      ctx.beginPath();
      ctx.moveTo(0, -32);
      ctx.lineTo(0, -14);
      ctx.stroke();
      
      // Vivid glowing physical helical coil spring
      ctx.strokeStyle = '#ff007f';
      ctx.lineWidth = 3.2;
      ctx.shadowBlur = 5;
      ctx.shadowColor = '#ff007f';
      ctx.beginPath();
      for (let sy = -31; sy <= -15; sy += 3.5) {
        ctx.moveTo(-4, sy);
        ctx.lineTo(4, sy + 1.8);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Remote nitrogen gas reservoir cylinder
      ctx.fillStyle = '#f59e0b'; // Gold anodized compression reservoir
      ctx.beginPath();
      ctx.roundRect(-8.5, -28, 3.5, 9, 1);
      ctx.fill();
      // Braided steel tube line crossing back
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-5, -24);
      ctx.bezierCurveTo(-3, -22, -2, -26, 0, -24);
      ctx.stroke();

      // 6. Symmetrical Dual-Mount Carbon Fiber Exhaust Canisters (Under-seat dual silencers)
      const throttleOn = keysPressedRef.current['w'] || keysPressedRef.current['arrowup'] || keysPressedRef.current['W'] || keysPressedRef.current['ArrowUp'];
      const speedProp = gameStateRef.current.playerSpeed / 240.0;
      const thrustIntensity = throttleOn ? 1.0 : speedProp * 0.6;
      
      const nozzles = [-23, 23];
      nozzles.forEach((nX) => {
        ctx.save();
        ctx.translate(nX, -18);
        ctx.rotate(nX < 0 ? -Math.PI / 18 : Math.PI / 18);

        // Solid carbon-fiber outer pipe sleeve with glossy finish
        const sleeveGrad = ctx.createLinearGradient(-6, -28, 6, 0);
        sleeveGrad.addColorStop(0, '#00e5ff'); // blue titanium heat fade
        sleeveGrad.addColorStop(0.25, '#ff007f'); // titanium anodize weld lines
        sleeveGrad.addColorStop(0.65, '#18161f'); // matte black carbon body
        sleeveGrad.addColorStop(1, '#030205');
        ctx.fillStyle = sleeveGrad;
        ctx.beginPath();
        ctx.roundRect(-6.5, -30, 13, 30, 3.5);
        ctx.fill();

        // Carbon weave cross-hatching effect (Adds extreme realism)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 0.7;
        for (let cw = -24; cw <= -4; cw += 4) {
          ctx.beginPath();
          ctx.moveTo(-5.5, cw);
          ctx.lineTo(5.5, cw + 2);
          ctx.stroke();
        }

        // Metal support straps
        ctx.fillStyle = '#475569';
        ctx.fillRect(-7.2, -14, 14.4, 2.5);

        // Internal exhaust back pressure core mesh
        ctx.fillStyle = '#06040a';
        ctx.beginPath();
        ctx.arc(0, 0, 4.2, 0, Math.PI * 2);
        ctx.fill();

        // Plasma Flame & Heat Ripple Plume (Spitting flames on active acceleration)
        if (gameStateRef.current.playerSpeed > 4 || throttleOn) {
          const plumeLength = (24 + thrustIntensity * 28) * (0.85 + Math.sin(timestamp * 0.08) * 0.15);
          const plumeWidth = 9 + thrustIntensity * 7;
          
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          
          const flameGrad = ctx.createLinearGradient(0, 0, 0, plumeLength);
          flameGrad.addColorStop(0, '#ffffff'); // pure white-hot core
          flameGrad.addColorStop(0.25, '#00f0ff'); // futuristic turquoise heat zone
          flameGrad.addColorStop(0.6, '#ff007f'); // burning violet-pink halo
          flameGrad.addColorStop(1, 'rgba(168, 85, 247, 0)');

          ctx.fillStyle = flameGrad;
          ctx.beginPath();
          ctx.moveTo(-plumeWidth/2, 0);
          ctx.bezierCurveTo(-plumeWidth * 1.5, plumeLength * 0.4, -plumeWidth * 0.2, plumeLength, 0, plumeLength);
          ctx.bezierCurveTo(plumeWidth * 0.2, plumeLength, plumeWidth * 1.5, plumeLength * 0.4, plumeWidth/2, 0);
          ctx.closePath();
          ctx.fill();

          // Combustion sparks
          if (timestamp % 2 === 0) {
            ctx.fillStyle = '#ffffff';
            for (let sp = 0; sp < 2; sp++) {
              const sx = (Math.random() - 0.5) * 8;
              const sy = Math.random() * plumeLength * 0.6;
              const ss = Math.random() * 2 + 0.6;
              ctx.beginPath();
              ctx.arc(sx, sy, ss, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          ctx.restore();
        } else {
          // Delicate Standby Wispy Exhaust Gas Smoke (slow-moving vapor when stationary or idling)
          if (timestamp % 3 === 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.fillStyle = isNight ? 'rgba(165, 180, 252, 0.15)' : 'rgba(203, 213, 225, 0.12)';
            ctx.beginPath();
            const smX = (Math.random() - 0.5) * 3;
            const smY = 4 + Math.random() * 8;
            const smR = Math.random() * 2.5 + 1.0;
            ctx.arc(smX, smY, smR, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
        ctx.restore();
      });

      // 7. Sleek Carbon-Fiber Aerodynamic Chassis & Sharp Tail Section Cowl
      ctx.fillStyle = '#040306'; // engine containment belly pan
      ctx.beginPath();
      ctx.moveTo(-25, -26);
      ctx.lineTo(25, -26);
      ctx.lineTo(18, -44);
      ctx.lineTo(-18, -44);
      ctx.closePath();
      ctx.fill();

       // Sharp streamlined superbike aerodynamic seat tail section
      const tailGrad = ctx.createLinearGradient(-26, -60, 26, -30);
      tailGrad.addColorStop(0, '#050408');
      tailGrad.addColorStop(0.35, '#1e082f'); // titanium carbon violet reflections
      tailGrad.addColorStop(0.65, '#35011d'); // hot pink edge light rimming
      tailGrad.addColorStop(1, '#050408');
      ctx.fillStyle = tailGrad;
      ctx.beginPath();
      ctx.moveTo(-24, -46);
      ctx.lineTo(24, -46);
      ctx.lineTo(19, -82);
      ctx.lineTo(-19, -82);
      ctx.closePath();
      ctx.fill();

      // Mask and overlay dual-diagonal racing Carbon-Weave finish texture inside the cowl
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-24, -46);
      ctx.lineTo(24, -46);
      ctx.lineTo(19, -82);
      ctx.lineTo(-19, -82);
      ctx.closePath();
      ctx.clip();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 0.8;
      for (let dg = -90; dg < -30; dg += 2.5) {
        ctx.beginPath();
        ctx.moveTo(-30, dg);
        ctx.lineTo(30, dg + 30);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      for (let dg = -90; dg < -30; dg += 2.5) {
        ctx.beginPath();
        ctx.moveTo(30, dg);
        ctx.lineTo(-30, dg + 30);
        ctx.stroke();
      }

      // Miniature Sponsor Decals & Racing Logos inside tail cowl
      ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
      ctx.font = '900 3.8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('EV-X', -8, -52);
      ctx.fillText('BREMBO', 8, -52);
      ctx.fillStyle = 'rgba(0, 240, 255, 0.5)';
      ctx.fillText('D3-SYS', 0, -60);
      ctx.restore();

      // Symmetrical carbon debris shield over custom levitational repulsor housing
      ctx.fillStyle = '#111015';
      ctx.beginPath();
      ctx.roundRect(-14, -26, 28, 8, 2);
      ctx.fill();

      // MotoGP Winglets (Exquisite aerodynamic split spoilers protruding left & right)
      // Left spoiler winglet
      ctx.fillStyle = '#08070d';
      ctx.beginPath();
      ctx.moveTo(-24, -58);
      ctx.lineTo(-37, -66);
      ctx.lineTo(-33, -71);
      ctx.lineTo(-21, -63);
      ctx.fill();
      
      ctx.strokeStyle = '#00f0ff'; // glowing cyan leading-edge trim
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-24, -58);
      ctx.lineTo(-37, -66);
      ctx.lineTo(-33, -71);
      ctx.stroke();

      // Right spoiler winglet
      ctx.fillStyle = '#08070d';
      ctx.beginPath();
      ctx.moveTo(24, -58);
      ctx.lineTo(37, -66);
      ctx.lineTo(33, -71);
      ctx.lineTo(21, -63);
      ctx.fill();

      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(24, -58);
      ctx.lineTo(37, -66);
      ctx.lineTo(33, -71);
      ctx.stroke();

      // Sharp fluorescent neon racing accents on seat panel flanks
      ctx.strokeStyle = '#ff007f';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-21, -50);
      ctx.lineTo(-17, -76);
      ctx.moveTo(21, -50);
      ctx.lineTo(17, -76);
      ctx.stroke();

      // 8. High-Intensity Discrete LED Taillight Dot-Matrix Chevrons
      const isBraking = keysPressedRef.current['s'] || keysPressedRef.current['arrowdown'] || keysPressedRef.current['S'] || keysPressedRef.current['ArrowDown'];
      ctx.save();
      ctx.shadowBlur = isBraking ? 18 : 8;
      ctx.shadowColor = '#ff003c';
      ctx.fillStyle = isBraking ? '#ff1e4b' : '#b90022';
      
      // Upper layout LED beads
      const upperBeads = [
        {x: -11, y: -80}, {x: -7.3, y: -78}, {x: -3.6, y: -76},
        {x: 0, y: -74.5},
        {x: 3.6, y: -76}, {x: 7.3, y: -78}, {x: 11, y: -80}
      ];
      upperBeads.forEach(bead => {
        ctx.beginPath();
        ctx.arc(bead.x, bead.y, isBraking ? 2.4 : 1.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = isBraking ? '#ffffff' : '#ffa1b2';
        ctx.beginPath();
        ctx.arc(bead.x, bead.y, isBraking ? 0.95 : 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = isBraking ? '#ff1e4b' : '#b90022';
      });

      // Lower V-shape layout LED beads
      const lowerBeads = [
        {x: -8, y: -74}, {x: -4, y: -71.5},
        {x: 0, y: -69.5},
        {x: 4, y: -71.5}, {x: 8, y: -74}
      ];
      lowerBeads.forEach(bead => {
        ctx.beginPath();
        ctx.arc(bead.x, bead.y, isBraking ? 2.4 : 1.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = isBraking ? '#ffffff' : '#ffa1b2';
        ctx.beginPath();
        ctx.arc(bead.x, bead.y, isBraking ? 0.95 : 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = isBraking ? '#ff1e4b' : '#b90022';
      });
      ctx.restore();

      // 9. Rear Fender License Plate Mount with Overhead License Lighting Lamp
      ctx.fillStyle = '#06050a';
      ctx.fillRect(-5, -46, 10, 24);
      
      // Overhead License micro LED illumination shadow cast
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.moveTo(-7, -42);
      ctx.lineTo(7, -42);
      ctx.lineTo(11, -33);
      ctx.lineTo(-11, -33);
      ctx.closePath();
      ctx.fill();

      // Compact white license plate with fusion fuchsia borders
      ctx.fillStyle = '#0a0910';
      ctx.fillRect(-11, -33, 22, 12);
      ctx.strokeStyle = '#ff007f';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(-11, -33, 22, 12);
      
      ctx.fillStyle = '#00f0ff'; // glowing license text
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('EVX-99', 0, -25);
      
      // Symmetrical plate reflector lamps (Amber)
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-9, -31, 2, 2);
      ctx.fillRect(7, -31, 2, 2);

      // 10. HIGH-FIDELITY RIDER-LESS CONTROLLERS (Sleek Handlebar clamp, fuel tank, and exposed Leather Seat)
      
      // A. SOLID CNC-MACHINED TRIPLE CLAMP YOKE, CLIP-ON HANDLEBARS & MIRRORS
      ctx.save();
      
      // CNC Machined billet aluminum Triple Clamp Yoke (Center steering control plate)
      ctx.fillStyle = '#1e293b'; // Anodized core silver-grey alloy
      ctx.beginPath();
      ctx.roundRect(-16, -104, 32, 6, 2);
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.0;
      ctx.stroke();

      // Steering stem center locking nut hex shape representation
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(0, -101, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(0, -101, 1.4, 0, Math.PI * 2);
      ctx.fill();

      // Symmetrical left fork-clamp attachment collar
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(-13.5, -101, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Symmetrical right fork-clamp attachment collar
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(13.5, -101, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Left clip-on handlebar shaft extending outwards
      ctx.fillStyle = '#2d2b38';
      ctx.fillRect(-35, -102.5, 20, 3.5);
      // Rubbery grooved superbike handgrip (Left side)
      ctx.fillStyle = '#020104';
      ctx.fillRect(-35, -102.5, 12, 3.5);
      // Machined chrome handlebar-end balancing weight tip
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(-37, -102.5, 2, 3.5);

      // Right clip-on handlebar shaft extending outwards
      ctx.fillStyle = '#2d2b38';
      ctx.fillRect(15, -102.5, 20, 3.5);
      // Rubbery grooved superbike handgrip (Right side)
      ctx.fillStyle = '#020104';
      ctx.fillRect(23, -102.5, 12, 3.5);
      // Machined chrome handlebar-end balancing weight tip
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(35, -102.5, 2, 3.5);

      // High-Fidelity details below triple clamp Yoke:
      // Translucent Brembo brake fluid reservoir bottle with yellow-oil inside, and a black cap
      ctx.fillStyle = 'rgba(217, 119, 6, 0.73)'; 
      ctx.beginPath();
      ctx.roundRect(14, -109, 4.5, 5.8, 1);
      ctx.fill();
      ctx.fillStyle = '#0f172a'; // cap
      ctx.fillRect(13.5, -110.5, 5.5, 1.8);
      ctx.strokeStyle = '#475569'; // bracket
      ctx.lineWidth = 0.8;
      ctx.strokeRect(14, -109, 4.5, 5.8);

      // Red Ignition/Kill rocker switch housing on the right handlebar block
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(21, -104.5, 2.0, 3.0);

      // Yellow LAP timer/starter button on the left handlebar block
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.arc(-22, -103, 1.0, 0, Math.PI * 2);
      ctx.fill();

      // Symmetrical braided stainless hydraulic lines snaking towards instrument cowling
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(15.5, -103.5);
      ctx.bezierCurveTo(9, -96.5, 4, -98.5, 0, -96.5);
      ctx.moveTo(-15.5, -103.5);
      ctx.bezierCurveTo(-9, -96.5, -4, -98.5, 0, -96.5);
      ctx.stroke();

      // Silver alloy brake and clutch control levers mounted ahead of handgrips
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-33, -99);
      ctx.lineTo(-24, -99);
      ctx.moveTo(33, -99);
      ctx.lineTo(24, -99);
      ctx.stroke();

      // EXQUISITE SHARP METALLIC REARVIEW MIRRORS
      // Left mirror housing
      ctx.fillStyle = '#111015'; // carbon weave mirror frame
      ctx.beginPath();
      ctx.moveTo(-28, -102);
      ctx.lineTo(-44, -114);
      ctx.lineTo(-38, -116);
      ctx.closePath();
      ctx.fill();
      
      // Reflection lens showing glowing neon azure glass
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.moveTo(-43, -114);
      ctx.lineTo(-39, -115.8);
      ctx.lineTo(-32, -111);
      ctx.closePath();
      ctx.fill();

      // Right mirror housing
      ctx.fillStyle = '#111015';
      ctx.beginPath();
      ctx.moveTo(28, -102);
      ctx.lineTo(44, -114);
      ctx.lineTo(38, -116);
      ctx.closePath();
      ctx.fill();
      
      // Reflection lens showing glowing neon azure glass
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.moveTo(43, -114);
      ctx.lineTo(39, -115.8);
      ctx.lineTo(32, -111);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      // B. AGGRESSIVE STREAMLINED FUEL TANK (Extends from steering stem base to seat)
      ctx.save();
      const tankGrad = ctx.createLinearGradient(-18, -100, 18, -68);
      tankGrad.addColorStop(0, '#040307');
      tankGrad.addColorStop(0.3, '#1e1b4b'); // deep indigo-violet metallic flake paint
      tankGrad.addColorStop(0.7, '#240a34'); // deep magenta shadow shading
      tankGrad.addColorStop(1, '#0c0a0f');
      ctx.fillStyle = tankGrad;
      ctx.beginPath();
      ctx.moveTo(-16, -97);
      ctx.bezierCurveTo(-22, -85, -20, -74, -14, -68);
      ctx.lineTo(14, -68);
      ctx.bezierCurveTo(20, -74, 22, -85, 16, -97);
      ctx.closePath();
      ctx.fill();

      // Mask and overlay dual-diagonal racing Carbon-Weave finish texture
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-16, -97);
      ctx.bezierCurveTo(-22, -85, -20, -74, -14, -68);
      ctx.lineTo(14, -68);
      ctx.bezierCurveTo(20, -74, 22, -85, 16, -97);
      ctx.closePath();
      ctx.clip();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 0.8;
      for (let dg = -120; dg < -40; dg += 2.5) {
        ctx.beginPath();
        ctx.moveTo(-25, dg);
        ctx.lineTo(25, dg + 25);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
      for (let dg = -120; dg < -40; dg += 2.5) {
        ctx.beginPath();
        ctx.moveTo(25, dg);
        ctx.lineTo(-25, dg + 25);
        ctx.stroke();
      }
      ctx.restore();

      // Aluminum fuel filler opening cap with ring bolts details
      ctx.fillStyle = '#0f172a'; // bezel ring
      ctx.beginPath();
      ctx.arc(0, -84, 5.0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#64748b'; // ring accents
      ctx.lineWidth = 0.8;
      ctx.stroke();

      ctx.fillStyle = '#334155'; // central locking key flap
      ctx.beginPath();
      ctx.arc(0, -84, 3.0, 0, Math.PI * 2);
      ctx.fill();
      
      // Symmetrical fluo-pink pinstripes running down the tank crown
      ctx.strokeStyle = '#ff007f';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-4, -94);
      ctx.lineTo(-2, -69);
      ctx.moveTo(4, -94);
      ctx.lineTo(2, -69);
      ctx.stroke();

      ctx.restore();

      // C. SPORT LEATHER SADDLE RIDER SEAT (Exposed cushion where the rider sat)
      ctx.save();
      // Matte charcoal leather gradient with light depth
      const seatGrad = ctx.createLinearGradient(-15, -68, 15, -45);
      seatGrad.addColorStop(0, '#08070b');
      seatGrad.addColorStop(0.5, '#15131b'); // textured seat cushion centers
      seatGrad.addColorStop(1, '#08070b');
      ctx.fillStyle = seatGrad;
      ctx.beginPath();
      ctx.moveTo(-15, -69);
      ctx.bezierCurveTo(-18, -60, -15, -46, -11, -44);
      ctx.lineTo(11, -44);
      ctx.bezierCurveTo(15, -46, 18, -60, 15, -69);
      ctx.closePath();
      ctx.fill();

      // High-contrast double pink stitching stripes for beautiful sports lines
      ctx.strokeStyle = 'rgba(255, 0, 127, 0.45)';
      ctx.lineWidth = 0.95;
      ctx.beginPath();
      ctx.moveTo(-13, -67);
      ctx.quadraticCurveTo(-15, -58, -10, -46);
      ctx.moveTo(13, -67);
      ctx.quadraticCurveTo(15, -58, 10, -46);
      ctx.stroke();

      // High tail support bumper pad block matching MotoGP specs
      ctx.fillStyle = '#060408';
      ctx.beginPath();
      ctx.roundRect(-8.5, -71.5, 17, 3, 0.8);
      ctx.fill();
      
      ctx.restore();

      // 11. HOLOGRAPHIC FLOATING TELEMETRY HUD SCREEN (CYBERPUNK GLASSES HEADS-UP GAUGE)
      ctx.save();
      ctx.translate(0, -142); // Floats elegant and slightly higher to prevent overlap
      
      // Glass screen backing panel (glowing fuchsia bounding borders)
      ctx.fillStyle = 'rgba(2, 1, 6, 0.65)';
      ctx.strokeStyle = 'rgba(255, 0, 127, 0.85)';
      ctx.lineWidth = 1.6;
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(255, 0, 127, 0.65)';
      ctx.beginPath();
      ctx.roundRect(-34, -22, 68, 44, 7);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Inside layout micro structural borders
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(-30, -18, 60, 36);

      // Micro telemetry grid lines
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
      ctx.lineWidth = 0.5;
      for (let gridX = -26; gridX <= 26; gridX += 13) {
        ctx.beginPath();
        ctx.moveTo(gridX, -18);
        ctx.lineTo(gridX, 18);
        ctx.stroke();
      }

      // Digital Status Indicators on the HUD flanks
      ctx.fillStyle = 'rgba(0, 240, 255, 0.8)';
      ctx.font = 'bold 4.5px monospace';
      ctx.fillText('SYS LINK: OK', -14, -13);
      ctx.fillStyle = '#ff007f';
      ctx.fillText('EV-X COPL', 15, -13);

      // Main Speedometer numbers
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 17px monospace';
      ctx.textAlign = 'center';
      const liveSpeedVal = Math.round(speed);
      ctx.fillText(`${liveSpeedVal}`, 0, -2);

      // KM/H units label
      ctx.fillStyle = '#00f0ff'; // cyber turquoise
      ctx.font = '800 6.5px monospace';
      ctx.fillText('KM/H SPRINT', 0, 6);

      // Active selected gearbox transmission ratio indicator
      ctx.fillStyle = '#ff007f'; // fuchsia hot pink active select
      ctx.font = '900 8.5px monospace';
      ctx.fillText(`GEAR G${gear}`, 0, 15);

      // Horizontal auxiliary system diagnostics bars
      const barW = 50;
      const rpmPercent = rpm / 16000;
      // Background track
      ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
      ctx.fillRect(-barW/2, -10, barW, 2);
      // Active bar
      ctx.fillStyle = rpm > 13000 ? '#ef4444' : '#00f0ff';
      ctx.fillRect(-barW/2, -10, barW * rpmPercent, 2);

      // Current light synchrony compatibility metric
      ctx.fillStyle = alignmentScore > 82 ? '#00ffaa' : '#cbd5e1';
      ctx.font = 'bold 5.5px monospace';
      ctx.fillText(`SYNC: ${Math.round(alignmentScore)}%`, 0, -8);

      ctx.restore(); // end HUD

      // 12. Wet Road Rear Repulsor Vaporized Steam & Spray Mist
      if (gameStateRef.current.weather === 'rain' && gameStateRef.current.playerSpeed > 10) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const sprayLength = 18 + (gameStateRef.current.playerSpeed / 240.0) * 36;
        const sprayAlpha = 0.16 + Math.random() * 0.08;
        const sprayGrad = ctx.createLinearGradient(0, 18, 0, 18 + sprayLength);
        sprayGrad.addColorStop(0, 'rgba(186, 250, 253, 0.45)'); // dense vaporized mist
        sprayGrad.addColorStop(0.5, `rgba(165, 243, 252, ${sprayAlpha})`);
        sprayGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = sprayGrad;
        
        // Symmetrical fan shape flaring out backwards from thrust contact point
        ctx.beginPath();
        ctx.moveTo(-6, 18);
        ctx.lineTo(-24, 18 + sprayLength);
        ctx.lineTo(24, 18 + sprayLength);
        ctx.lineTo(6, 18);
        ctx.closePath();
        ctx.fill();

        // Miniature superheated droplets being thrown dynamically from the thrust field
        ctx.fillStyle = 'rgba(224, 242, 254, 0.72)';
        for (let wd = 0; wd < 6; wd++) {
          const dropX = (Math.random() - 0.5) * 22;
          const dropY = 18 + Math.random() * sprayLength * 0.85;
          const dropS = Math.random() * 1.8 + 0.6;
          ctx.beginPath();
          ctx.arc(dropX, dropY, dropS, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      ctx.restore(); // end Vehicle Transform

      // Wrap old cockpit in unreachable block to cleanly bypass it
      if (false as boolean) {
      ctx.save();
      // Position the cockpit at the player's lateral coordinate, resting near the bottom edge
      ctx.translate(playerRenderX, canvas.height + 42);

      // Handle steering lean roll (handles pivot/swivel dynamically inside our hands)
      const steerDeviation = (gameStateRef.current.targetSteeringY - gameStateRef.current.playerSteeringY) * 0.02;
      const rollAngle = (gameStateRef.current.playerSteeringY * 0.015) + (steerDeviation * 1.2);
      ctx.rotate(rollAngle);

      // Inline-4 High speed engine vibration check
      const vibrationHz = rpm / 16000;
      const vibX = vibrationHz * (Math.random() - 0.5) * 1.6;
      const vibY = vibrationHz * (Math.random() - 0.5) * 1.6;
      ctx.translate(vibX, vibY);

      // A. SHINY METALLIC GLOSSY FUEL TANK (Glossy Jet-Black with Pink & Violet Reflections)
      const tankGrad = ctx.createLinearGradient(-90, 20, 90, 100);
      tankGrad.addColorStop(0, '#030206'); 
      tankGrad.addColorStop(0.35, '#120524'); // subtle dark purple reflection
      tankGrad.addColorStop(0.65, '#2b031c'); // subtle dark pink reflection
      tankGrad.addColorStop(1, '#08070d');
      ctx.fillStyle = tankGrad;
      ctx.beginPath();
      ctx.moveTo(-100, 120);
      ctx.bezierCurveTo(-115, 45, -75, 12, -45, 12);
      ctx.lineTo(45, 12);
      ctx.bezierCurveTo(75, 12, 115, 45, 100, 120);
      ctx.closePath();
      ctx.fill();

      // Polished glossy glaze highlight curves on the black tank shell
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 12, 42, Math.PI, 2 * Math.PI);
      ctx.stroke();

      // Premium double-layer racing stripes (Neon Hot Pink & Electric Violet)
      // Pink stripe left
      ctx.fillStyle = '#ff007f';
      ctx.beginPath();
      ctx.moveTo(-75, 55);
      ctx.lineTo(-45, 22);
      ctx.lineTo(-48, 20);
      ctx.lineTo(-80, 50);
      ctx.closePath();
      ctx.fill();

      // Purple stripe left
      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.moveTo(-70, 55);
      ctx.lineTo(-42, 24);
      ctx.lineTo(-44, 22);
      ctx.lineTo(-74, 52);
      ctx.closePath();
      ctx.fill();

      // Pink stripe right
      ctx.fillStyle = '#ff007f';
      ctx.beginPath();
      ctx.moveTo(75, 55);
      ctx.lineTo(45, 22);
      ctx.lineTo(48, 20);
      ctx.lineTo(80, 50);
      ctx.closePath();
      ctx.fill();

      // Purple stripe right
      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.moveTo(70, 55);
      ctx.lineTo(42, 24);
      ctx.lineTo(44, 22);
      ctx.lineTo(74, 52);
      ctx.closePath();
      ctx.fill();

      // Concentric metallic silver fuel gas cap
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(0, 56, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#020105';
      ctx.beginPath();
      ctx.arc(0, 56, 21, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(0, 56, 12, 0, Math.PI * 2);
      ctx.fill();
      // Hex rivet screw details
      ctx.fillStyle = '#64748b';
      for (let rxAngle = 0; rxAngle < Math.PI * 2; rxAngle += Math.PI / 3) {
        ctx.beginPath();
        ctx.arc(Math.cos(rxAngle) * 17, 56 + Math.sin(rxAngle) * 17, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // B. METALLIC TRIPLE CLAMP STEM PLATE (Anodized matte black with carbon fiber texture)
      ctx.fillStyle = '#0a090e'; 
      ctx.beginPath();
      ctx.moveTo(-115, -4);
      ctx.lineTo(-45, -4);
      ctx.lineTo(-20, 10);
      ctx.lineTo(20, 10);
      ctx.lineTo(45, -4);
      ctx.lineTo(115, -4);
      ctx.lineTo(100, -25);
      ctx.lineTo(-100, -25);
      ctx.closePath();
      ctx.fill();

      // Micro carbon weaves pattern overlay
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.08)'; // cool violet carbon reflect
      ctx.lineWidth = 1;
      for (let cW = -100; cW <= 100; cW += 6) {
        ctx.beginPath();
        ctx.moveTo(cW, -25);
        ctx.lineTo(cW + 15, 10);
        ctx.stroke();
      }

      // Center gold stem head nut
      ctx.fillStyle = '#020204';
      ctx.beginPath();
      ctx.arc(0, -2, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff007f'; // anodized pink-red collar ring
      ctx.beginPath();
      ctx.arc(0, -2, 6, 0, Math.PI * 2);
      ctx.fill();

      // Ignition key housing with glowing key element
      ctx.fillStyle = '#020105';
      ctx.fillRect(-6, -21, 12, 8);
      ctx.fillStyle = '#a855f7'; // purple neon key tag
      ctx.fillRect(-2, -19, 4, 10);

      // C. AGGRESSIVE SPORT SUPERSPORT CLIP-ONS
      ctx.strokeStyle = '#050408';
      ctx.lineWidth = 15;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-45, -14);
      ctx.lineTo(-145, -9); // Left handlebar
      ctx.moveTo(45, -14);
      ctx.lineTo(145, -9); // Right handlebar
      ctx.stroke();

      // Texturized premium black micro-rib handlebars
      ctx.strokeStyle = '#08070d';
      ctx.lineWidth = 18;
      ctx.beginPath();
      ctx.moveTo(-102, -11);
      ctx.lineTo(-145, -9);
      ctx.moveTo(102, -11);
      ctx.lineTo(145, -9);
      ctx.stroke();

      // Left bar-ends
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(-146, -9, 7, 0, Math.PI * 2);
      ctx.arc(146, -9, 7, 0, Math.PI * 2);
      ctx.fill();

      // D. HIGH-DETAIL TEXTURED RACING GLOVES (Premium details & stitching)
      // Left glove wrapping the grip
      ctx.fillStyle = '#07060a'; // carbon fiber matte-black glove body
      ctx.beginPath();
      ctx.roundRect(-138, -21, 25, 26, 4);
      ctx.fill();
      
      // Stitching style overlays (Neon Hot Pink)
      ctx.strokeStyle = '#ff007f';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-138, -10);
      ctx.lineTo(-113, -10);
      ctx.stroke();

      ctx.fillStyle = '#020104'; // palm joint fold
      ctx.beginPath();
      ctx.moveTo(-142, -5);
      ctx.bezierCurveTo(-148, 15, -135, 30, -112, 35);
      ctx.lineTo(-98, 15);
      ctx.lineTo(-118, -8);
      ctx.closePath();
      ctx.fill();

      // Anodized knuckle protection guards (Sleek carbon shields)
      ctx.fillStyle = '#1e1b4b'; // deep indigo knuckles shell
      ctx.beginPath();
      ctx.roundRect(-136, -17, 20, 8, 2);
      ctx.fill();
      ctx.fillStyle = '#a855f7'; // violet protective inserts
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.arc(-133 + k * 4.6, -13, 2.0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Right throttle-twisting racing glove
      const throttleTwist = keysPressedRef.current['w'] || keysPressedRef.current['arrowup'] ? 4.5 : 0;
      ctx.save();
      ctx.translate(122, -1);
      ctx.rotate(throttleTwist * 0.04);
      
      ctx.fillStyle = '#07060a';
      ctx.beginPath();
      ctx.roundRect(-12, -21, 25, 26, 4);
      ctx.fill();

      // Neon pink knuckle-stitch lines
      ctx.strokeStyle = '#ff007f';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-12, -10);
      ctx.lineTo(13, -10);
      ctx.stroke();
      
      ctx.fillStyle = '#020104';
      ctx.beginPath();
      ctx.moveTo(-14, -8);
      ctx.lineTo(-4, 14);
      ctx.bezierCurveTo(14, 30, 26, 12, 21, -6);
      ctx.closePath();
      ctx.fill();
      
      ctx.fillStyle = '#1e1b4b'; // carbon knuckle shield right
      ctx.beginPath();
      ctx.roundRect(-10, -17, 20, 8, 2);
      ctx.fill();
      ctx.fillStyle = '#a855f7';
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.arc(-7 + k * 4.6, -13, 2.0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // E. CHROMATIC SLIDER LEVERS
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 3.5;
      // Clutch lever
      ctx.beginPath();
      ctx.moveTo(-92, -13);
      ctx.lineTo(-145, -15);
      ctx.stroke();

      // Front brake lever (Dynamic pull on hit braking)
      const isBraking = keysPressedRef.current['s'] || keysPressedRef.current['arrowdown'];
      const brakePull = isBraking ? 6.2 : 0;
      ctx.beginPath();
      ctx.moveTo(92, -13);
      ctx.lineTo(145 - brakePull * 1.5, -15 + brakePull);
      ctx.stroke();

      // F. SWITCH CLUSTERS with Cyber emergency buttons
      ctx.fillStyle = '#111015';
      ctx.fillRect(-96, -24, 18, 16); // left switchblock
      ctx.fillRect(78, -24, 18, 16); // right switchblock
      
      ctx.fillStyle = '#ff0055'; // Emergency hazard switch glowing pink-red
      ctx.fillRect(84, -22, 7, 7);

      // G. BRAKE FLUID RESERVOIR CYLINDER (Glowing neon purple brake formula)
      ctx.fillStyle = '#000000';
      ctx.fillRect(72, -43, 2, 20); // support bar
      ctx.fillStyle = 'rgba(168, 85, 247, 0.78)'; // high performance DOT 5 purple brake oil
      ctx.beginPath();
      ctx.roundRect(64, -58, 20, 16, 3.5);
      ctx.fill();
      ctx.strokeStyle = '#f472b6'; // glowing pink border cap leak check
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#0a090e';
      ctx.fillRect(62, -61, 24, 4);

      // H. FIRST-CLASS DUAL REARVIEW MIRRORS
      ctx.strokeStyle = '#050408';
      ctx.lineWidth = 4.8;
      
      // Left Mirror assembly
      ctx.beginPath();
      ctx.moveTo(-75, -24);
      ctx.lineTo(-172, -82);
      ctx.stroke();

      ctx.save();
      ctx.translate(-196, -92);
      ctx.rotate(-rollAngle * 0.4);
      
      // Outer mirror head casing
      ctx.fillStyle = '#08070d';
      ctx.beginPath();
      ctx.ellipse(0, 0, 38, 19, Math.PI / 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#3f3f46';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Glowing reflection panel
      ctx.fillStyle = '#050212';
      ctx.beginPath();
      ctx.ellipse(0, 0, 35, 16, Math.PI / 10, 0, Math.PI * 2);
      ctx.fill();

      // Mirrors reflection horizon road
      ctx.fillStyle = '#010005';
      ctx.beginPath();
      ctx.moveTo(-18, 8);
      ctx.lineTo(25, -6);
      ctx.lineTo(5, -12);
      ctx.lineTo(-32, 2);
      ctx.closePath();
      ctx.fill();

      // Glowing rear neon lights (Tail-lights of racers behind you)
      ctx.fillStyle = '#ff0055';
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#ff0055';
      ctx.beginPath();
      ctx.arc(8, -1, 1.8, 0, Math.PI * 2);
      ctx.arc(-14, 3, 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();

      // Right Mirror assembly
      ctx.beginPath();
      ctx.moveTo(75, -24);
      ctx.lineTo(172, -82);
      ctx.stroke();

      ctx.save();
      ctx.translate(196, -92);
      ctx.rotate(rollAngle * 0.4);
      
      // Outer mirror head casing
      ctx.fillStyle = '#08070d';
      ctx.beginPath();
      ctx.ellipse(0, 0, 38, 19, -Math.PI / 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#3f3f46';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Reflection mirror slice
      ctx.fillStyle = '#050212';
      ctx.beginPath();
      ctx.ellipse(0, 0, 35, 16, -Math.PI / 10, 0, Math.PI * 2);
      ctx.fill();

      // Horizon line
      ctx.fillStyle = '#010005';
      ctx.beginPath();
      ctx.moveTo(18, 8);
      ctx.lineTo(-25, -6);
      ctx.lineTo(-5, -12);
      ctx.lineTo(32, 2);
      ctx.closePath();
      ctx.fill();

      // Warning hazard blinker reflection
      ctx.fillStyle = '#ff0055';
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#ff0055';
      ctx.beginPath();
      ctx.arc(-8, -1, 1.8, 0, Math.PI * 2);
      ctx.arc(14, 3, 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();

      // I. COHESIVE CYBERPUNK COCKPIT DIGITAL INSTRUMENT CLUSTER
      ctx.save();
      ctx.translate(0, -56);
      
      ctx.fillStyle = '#07060a'; // outer bezel frame
      ctx.beginPath();
      ctx.arc(0, 0, 38, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff007f'; // cyber-pink bezel highlight border
      ctx.lineWidth = 1.5;
      ctx.stroke();
      
      ctx.fillStyle = '#010005'; // pure black glass LCD panel
      ctx.beginPath();
      ctx.arc(0, 0, 33, 0, Math.PI * 2);
      ctx.fill();

      // RPM perimeter track guidelines
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.16)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, 27, -1.25 * Math.PI, 0.25 * Math.PI);
      ctx.stroke();

      // Glowing Active RPM speedometer arc (Transitions beautifully from Purple to Hot Pink & Redline)
      const activeRpmPercent = rpm / 16000;
      const rpmAngle = (activeRpmPercent * 1.5 - 1.25) * Math.PI;
      const rpmColor = rpm > 13000 ? '#ef4444' : rpm > 8000 ? '#ff007f' : '#a855f7';
      
      ctx.strokeStyle = rpmColor;
      ctx.shadowBlur = 8;
      ctx.shadowColor = rpmColor;
      ctx.beginPath();
      ctx.arc(0, 0, 27, -1.25 * Math.PI, rpmAngle);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Fuel & Engine temp side indicators (Futuristic digital gauges detailing)
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(-22, 2, 2.5, 6);
      ctx.fillStyle = '#ff007f';
      ctx.fillRect(20, 2, 2.5, 6);

      // Gear Box panel (G1 to G6)
      ctx.fillStyle = '#090514';
      ctx.fillRect(-17, -18, 12, 10);
      ctx.strokeStyle = '#ff007f'; // pink active gear border
      ctx.lineWidth = 0.8;
      ctx.strokeRect(-17, -18, 12, 10);
      
      ctx.fillStyle = '#ff007f';
      ctx.font = 'bold 8.5px monospace';
      ctx.fillText(`G${gear}`, -11, -10);

      // Large Speed readout typography
      ctx.fillStyle = '#ffffff';
      ctx.font = 'black 19px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(speed)}`, 4, 3);

      // "km/h" label
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 7px monospace';
      ctx.fillText('km/h', 0, 11);

      // Superbike signature branding text
      ctx.fillStyle = '#a855f7';
      ctx.font = '900 6.5px sans-serif';
      ctx.fillText('EV-X HYPER', 0, 22);

      // Bezel glass glare overlay
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 29, 29, Math.PI / 4, -Math.PI / 2, Math.PI / 2);
      ctx.fill();

      ctx.restore(); // end HUD
      }
      ctx.restore(); // end Cockpit Transform

      // -----------------------------------------------------------
      // JAGGED ELECTRIC ALIGNMENT FILAMENT (Sparks from instrument console to target path!)
      // -----------------------------------------------------------
      if (gameStateRef.current.status === 'racing') {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.strokeStyle = alignmentScore > 82 ? '#00ffff' : alignmentScore > 45 ? '#fbbf24' : '#ef4444';
        ctx.lineWidth = alignmentScore > 82 ? 3.5 : 1.5;
        ctx.shadowBlur = 10;
        ctx.shadowColor = ctx.strokeStyle;
        
        ctx.beginPath();
        // Starts directly at the central cockpit speed gauge!
        ctx.moveTo(playerRenderX, playerActualY - 14);
        
        const electricSteps = 5;
        for (let s = 1; s <= electricSteps; s++) {
          const ratio = s / electricSteps;
          const currentTargetX = playerRenderX + (targetTrackXOfPlayer - playerRenderX) * ratio;
          const noiseX = (Math.random() - 0.5) * 8 * (1 - ratio);
          const noiseY = (Math.random() - 0.5) * 5;
          ctx.lineTo(currentTargetX + noiseX, playerActualY - 14 + (playerActualY + 20 - (playerActualY - 14)) * ratio + noiseY);
        }
        ctx.stroke();
        ctx.restore();
      }

      // 7. Draw target alignment UI ring
      ctx.strokeStyle = alignmentScore > 82 ? '#00ffff' : alignmentScore > 45 ? '#fbbf24' : '#ef4444';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(targetTrackXOfPlayer, playerActualY + 20, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Sync percentage hovering above target ring
      ctx.fillStyle = alignmentScore > 82 ? '#00ffff' : '#cbd5e1';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(`${alignmentScore}% SYNC`, targetTrackXOfPlayer + 26, playerActualY + 23);

      // Render Trailing or leading competitor motorcycle icons in 3D perspective
      gameStateRef.current.racers.forEach((r) => {
        if (r.isPlayer) return;

        // Position based on displacement metric
        const meterDiff = r.distance - gameStateRef.current.distanceTraveled;
        const competitorP = 0.82 + (meterDiff * 0.0028);

        if (competitorP > 0.05 && competitorP < 1.05) {
          const curveFactor = Math.pow(competitorP, 1.8);
          const compRoadCenterX = horizonX + Math.sin(lightWaveOffset + competitorP * 3.4) * (canvas.width * 0.22) * curveFactor;
          
          const idHash = r.id === 'racer_1' ? -0.22 : r.id === 'racer_2' ? 0.24 : -0.05;
          const compW = roadWidthHorizon + (roadWidthBottom - roadWidthHorizon) * competitorP;
          const compX = compRoadCenterX + idHash * compW;
          const compY = horizonY + competitorP * (canvas.height - horizonY);
          const compScale = competitorP * 0.82;

          // -----------------------------------------------------------
          // HIGH-SPEED NEAR-MISS COLLISION SENSING TRIGGER
          // -----------------------------------------------------------
          if (Math.abs(meterDiff) < 5.8 && Math.abs(compX - playerRenderX) < 42 && gameStateRef.current.playerSpeed > 90) {
            if (timestamp - commentatorStateRef.current.lastNearMissTime > 4500) {
              const nearMissQuotes = [
                `Inches from impact! Hair-thin near-miss with ${r.name}!`,
                `Slicing the gap! Absolute pure ice in this rider's veins!`,
                `Adrenaline surge! Splitting lanes with ${r.name} at high-velocity!`,
                `Exquisite lane split! Scraped and squeezed past ${r.name}!`
              ];
              triggerCommentaryRef.current(nearMissQuotes[Math.floor(Math.random() * nearMissQuotes.length)], 'near-miss');
              commentatorStateRef.current.lastNearMissTime = timestamp;
            }
          }

          ctx.save();
          ctx.translate(compX, compY);
          ctx.scale(compScale, compScale);

          // Contact Shadow
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.beginPath();
          ctx.ellipse(0, 10, 16, 4, 0, 0, Math.PI*2);
          ctx.fill();

          if (meterDiff > 0) {
            // Competitive bike viewed from the REAR (ahead of player)
            // Rear Tyre
            ctx.fillStyle = '#0a0a0c';
            ctx.beginPath();
            ctx.roundRect(-6, 0, 12, 11, 3);
            ctx.fill();

            // Main Tail cowl
            ctx.fillStyle = r.color;
            ctx.beginPath();
            ctx.moveTo(-10, -9);
            ctx.lineTo(10, -9);
            ctx.lineTo(7, 3);
            ctx.lineTo(-7, 3);
            ctx.closePath();
            ctx.fill();

            // Bright red glowing tail light
            ctx.fillStyle = '#ff1d3f';
            ctx.shadowBlur = 6;
            ctx.shadowColor = '#ff1d3f';
            ctx.beginPath();
            ctx.arc(-3, -7, 1.5, 0, Math.PI * 2);
            ctx.arc(3, -7, 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            // Helmet
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.arc(0, -14, 5.5, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Overtaking competitive bike viewed from the FRONT (headlights approaching rearview)
            // Front Tyre
            ctx.fillStyle = '#0a0a0c';
            ctx.beginPath();
            ctx.roundRect(-5, 0, 10, 11, 3);
            ctx.fill();

            // Front cowl
            ctx.fillStyle = r.color;
            ctx.beginPath();
            ctx.moveTo(-10, -9);
            ctx.lineTo(10, -9);
            ctx.lineTo(5, 5);
            ctx.lineTo(-5, 5);
            ctx.closePath();
            ctx.fill();

            // Bright white glowing dual headlights
            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ffffff';
            ctx.beginPath();
            ctx.arc(-4, -6, 2, 0, Math.PI * 2);
            ctx.arc(4, -6, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            // Helmet visor cyan tint
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.arc(0, -14, 5.5, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();

          // Racer hover tagline
          ctx.font = 'bold 8px monospace';
          ctx.fillStyle = '#cbd5e1';
          ctx.textAlign = 'center';
          ctx.fillText(r.name.split(' ')[0], compX, compY - 22 * compScale);
        }
      });

      ctx.restore(); // -> CLOSE UNREAL CAMERA context

      // -----------------------------------------------------------
      // HIGH-FIDELITY SPEED LENS BLUR (Radial Speed streaks)
      // -----------------------------------------------------------
      if (curSpeed > 80) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const blurAlpha = Math.min(0.42, (curSpeed - 80) / 160.0);
        ctx.strokeStyle = `rgba(32, 220, 255, ${blurAlpha * 0.38})`;
        ctx.lineWidth = 1.15;
        
        // Dynamic radial speed streaks firing from tunnel center
        const numLines = Math.floor(8 + speedPct * 12);
        for (let sl = 0; sl < numLines; sl++) {
          const ang = (sl / numLines) * Math.PI * 2;
          const startR = canvas.width * 0.38;
          const endR = canvas.width * 0.54;
          
          const offsetCycle = (timestamp * 0.015 + sl * 4) % (endR - startR);
          const r1 = startR + offsetCycle;
          const r2 = Math.min(canvas.width * 0.65, r1 + 35 * speedPct);
          
          const sx = canvas.width/2 + Math.cos(ang) * r1;
          const sy = horizonY + Math.sin(ang) * r1 * 0.6;
          const ex = canvas.width/2 + Math.cos(ang) * r2;
          const ey = horizonY + Math.sin(ang) * r2 * 0.6;
          
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();
        }
        ctx.restore();
      }

      // -----------------------------------------------------------
      // PHOTOREALISTIC HEADLIGHT BLOOM LENS FLARE (Anamorphic flare artifacts)
      // -----------------------------------------------------------
      if (curSpeed > 10) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        
        // Calculate flare centers offset from projected headlight coordinates
        const lensX = playerRenderX + camTranslateX;
        const lensY = playerActualY - 14 + camTranslateY;
        const screenCenterX = canvas.width / 2;
        const screenCenterY = canvas.height / 2;
        
        // Direction vector from screen center to light source
        const dx = lensX - screenCenterX;
        const dy = lensY - screenCenterY;
        
        const flareNodes = [
          { ratio: -0.4, size: 28, color: 'rgba(255, 0, 127, 0.12)' }, // pink flare ring
          { ratio: 0.25, size: 15, color: 'rgba(0, 240, 255, 0.16)' }, // cyan circle
          { ratio: 0.7, size: 48, color: 'rgba(168, 85, 247, 0.08)' }  // violet wide ring
        ];
        
        flareNodes.forEach(node => {
          const fx = screenCenterX + dx * node.ratio;
          const fy = screenCenterY + dy * node.ratio;
          
          const fGrad = ctx.createRadialGradient(fx, fy, 1, fx, fy, node.size);
          fGrad.addColorStop(0, '#ffffff'); // bright hotspot Core
          fGrad.addColorStop(0.35, node.color);
          fGrad.addColorStop(1, 'rgba(0,0,0,0)');
          
          ctx.fillStyle = fGrad;
          ctx.beginPath();
          ctx.arc(fx, fy, node.size, 0, Math.PI * 2);
          ctx.fill();
          
          // Soft diffraction fringe rings
          ctx.strokeStyle = node.color.replace('0.', '0.04');
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.arc(fx, fy, node.size * 1.25, 0, Math.PI * 2);
          ctx.stroke();
        });

        // Add premium Anamorphic blue laser line streak covering the horizontal screen
        const blueStreakGrad = ctx.createLinearGradient(lensX - 160, lensY, lensX + 160, lensY);
        blueStreakGrad.addColorStop(0, 'rgba(0, 240, 255, 0)');
        blueStreakGrad.addColorStop(0.5, 'rgba(0, 240, 255, 0.26)');
        blueStreakGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.58)'); // glaring white center
        blueStreakGrad.addColorStop(0.5, 'rgba(0, 240, 255, 0.26)');
        blueStreakGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
        ctx.fillStyle = blueStreakGrad;
        ctx.fillRect(lensX - 160, lensY - 1, 320, 2);

        ctx.restore();
      }

      // -----------------------------------------------------------
      // MOBILE GESTURES DRAG INTERACTION OVERLAY (On-Canvas Interactive HUD)
      // -----------------------------------------------------------
      if (pointerRef.current.isActive) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        
        const ptX = pointerRef.current.x;
        const ptY = pointerRef.current.y;
        
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ptX, ptY, 22 + Math.sin(timestamp * 0.015) * 3, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(34, 211, 238, 0.45)';
        ctx.beginPath();
        ctx.arc(ptX, ptY, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(34, 211, 238, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ptX - 32, ptY);
        ctx.lineTo(ptX + 32, ptY);
        ctx.moveTo(ptX, ptY - 32);
        ctx.lineTo(ptX, ptY + 32);
        ctx.stroke();

        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = '#22d3ee';
        ctx.fillText(`STEER LEAN: ${Math.round(targetSteeringY)}°`, ptX + 28, ptY + 4);
        ctx.fillText(`THROTTLE ACTIVE`, ptX - 42, ptY - 28);
        
        ctx.font = '9px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText(`◀ UNIFIED SLIDE / ACCEL ▶`, ptX - 60, ptY + 42);

        ctx.restore();
      }

      // Draw falling rain particle overlay on topmost canvas layer
      if (gameStateRef.current.weather === 'rain') {
        ctx.save();
        ctx.strokeStyle = isNight ? 'rgba(34, 211, 238, 0.45)' : 'rgba(99, 102, 241, 0.35)'; // bioluminescent cyan streaks
        ctx.lineWidth = 1.35;
        raindrops.forEach(drop => {
          ctx.beginPath();
          ctx.moveTo(drop.x, drop.y);
          // Angle drops slightly to model wind and steering direction shear speed!
          const angleX = drop.speedX - (gameStateRef.current.playerSteeringY * 0.08);
          ctx.lineTo(drop.x + angleX * 1.05, drop.y + drop.speedY * 1.05);
          ctx.stroke();
        });
        ctx.restore();
      }

      // 8. Handle race completion metrics
      if (gameStateRef.current.distanceTraveled >= gameStateRef.current.settings.totalDistance) {
        setRaceStatus('finished');
        gameStateRef.current.status = 'finished';
        setRacers(gameStateRef.current.racers);
        engineSynthRef.current?.stop();
        setCommentary(null); // Clear any active commentary on completion
      }

      gameLoopTime++;
      animationFrameId = requestAnimationFrame(gameTick);
    };

    animationFrameId = requestAnimationFrame(gameTick);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, [isAudioMuted]);

  // Handle countdown triggers
  const startCountdown = () => {
    if (raceStatus === 'finished') {
      resetGame();
    }
    setCountdown(3);
    setRaceStatus('countdown');
    gameStateRef.current.status = 'countdown';
    if (!isAudioMuted) {
      engineSynthRef.current?.start();
    }
  };

  useEffect(() => {
    if (countdown === null) return;

    if (countdown === 0) {
      setCountdown(null);
      setRaceStatus('racing');
      gameStateRef.current.status = 'racing';
      gameStateRef.current.playerTargetSpeed = 125.0; // initial Kawasaki inline-4 acceleration spike!

      // Commentator launch call
      const startQuotes = [
        "System linkage online! Engines are screaming at the start gate!",
        "All systems clear. Throttle down, let the Inline-4 sing!",
        "The neon pavement is wet and ready. Shift into first and launch!"
      ];
      triggerCommentary(startQuotes[Math.floor(Math.random() * startQuotes.length)], 'start');
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  // Touch Throttle Booster gesture controls
  const handleTouchThrottleBoost = () => {
    if (raceStatus === 'idle') {
      startCountdown();
      return;
    }
    if (raceStatus !== 'racing') return;
    const currentAlignment = gameStateRef.current.lightAlignment;
    const rpmBoostMultiplier = currentAlignment > 80 ? 16.5 : 8.0;

    gameStateRef.current.playerTargetSpeed = Math.min(gameStateRef.current.playerTargetSpeed + rpmBoostMultiplier, 238);
    setStamina(s => Math.min(s + 3, 100)); // adds throttle endurance boost
  };

  // Reset metrics
  const resetGame = () => {
    setRaceStatus('idle');
    gameStateRef.current.status = 'idle';
    gameStateRef.current.playerSpeed = 0;
    gameStateRef.current.playerTargetSpeed = 0;
    gameStateRef.current.distanceTraveled = 0;
    gameStateRef.current.trackXScroll = 0;
    setPlayerSteeringY(0);
    setTargetSteeringY(0);
    setStamina(100);
    engineSynthRef.current?.stop();

    // Reset commentator refs
    commentatorStateRef.current = {
      lastNearMissTime: 0,
      lastRankUpTime: 0,
      lastRankDownTime: 0,
      lastTopSpeedTime: 0,
      lastRedlineTime: 0,
      currentPostRank: 2,
      hasTriggeredTopSpeed: false,
    };
    setCommentary(null);

    setRacers([
      {
        id: 'player',
        name: 'ZX-Custom (EV-X)',
        avatar: '🏍️',
        color: '#ff007f',
        speed: 0,
        targetSpeed: 0,
        distance: 0,
        rank: 2,
        isPlayer: true,
        lightAlignment: 100,
        engineRpm: 1350,
      },
      {
        id: 'racer_1',
        name: 'D3-SYS Cyclone',
        avatar: '🤖',
        color: '#00e5ff',
        speed: 0,
        targetSpeed: 0,
        distance: 12,
        rank: 1,
        isPlayer: false,
        lightAlignment: 0,
        engineRpm: 1350,
      },
      {
        id: 'racer_2',
        name: 'EVX CyberPhantom',
        avatar: '🧬',
        color: '#a855f7',
        speed: 0,
        targetSpeed: 0,
        distance: -8,
        rank: 3,
        isPlayer: false,
        lightAlignment: 0,
        engineRpm: 1350,
      },
      {
        id: 'racer_3',
        name: 'Brembo Interceptor',
        avatar: '🦊',
        color: '#fbbf24',
        speed: 0,
        targetSpeed: 0,
        distance: -20,
        rank: 4,
        isPlayer: false,
        lightAlignment: 0,
        engineRpm: 1350,
      }
    ]);
  };

  const steerAction = (direction: 'left' | 'right') => {
    if (direction === 'left') {
      setTargetSteeringY(y => Math.max(y - 15, -45));
    } else {
      setTargetSteeringY(y => Math.min(y + 15, 45));
    }
  };

  const isLowLightTheme = settings.isLowLightTheme;
  const liveRank = [...racers].sort((a,b) => b.distance - a.distance).findIndex(r => r.isPlayer) + 1;

  return (
    <div
      id="app-container"
      className={`min-h-screen font-sans flex flex-col transition-colors duration-300 ${
        isLowLightTheme ? 'bg-slate-950 text-slate-100' : 'bg-slate-900 text-slate-100'
      }`}
    >
      {/* Top Navigation Status Bar */}
      <nav className="z-20 flex items-center justify-between px-6 py-4 bg-slate-900/60 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20">
            <Flame className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-green-400 font-semibold font-mono">SUPERSPEED SERIES</span>
            <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
              MIDNIGHT HIGHWAY <span className="text-xs bg-green-950 text-green-400 border border-green-800 px-2 py-0.5 rounded font-mono">399cc Inline-4</span>
            </h1>
          </div>
        </div>

        {/* Audio control & Theme Toggle row */}
        <div className="flex items-center gap-5">
          <div className="text-center hidden md:block border-r border-white/10 pr-5">
            <span className="text-[9px] uppercase tracking-widest text-slate-400 block font-mono">Ambient Sky Time</span>
            <span className="text-xs font-mono font-bold text-cyan-400 flex items-center gap-1">
              <Clock className="w-3 h-3 text-cyan-400" /> {currentTime}
            </span>
          </div>

          {/* Web Audio Mute toggle button */}
          <button
            onClick={() => setIsAudioMuted(!isAudioMuted)}
            className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-mono font-bold transition-all ${
              !isAudioMuted
                ? 'bg-green-500 text-black border-green-400 shadow-md shadow-green-500/10'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-100'
            }`}
            title={isAudioMuted ? "Unmute Engine Sound (Recommended)" : "Mute Sound"}
            id="audio-synth-toggle"
          >
            {isAudioMuted ? (
              <>
                <VolumeX className="w-4 h-4 text-rose-400" />
                <span className="hidden sm:inline">SOUND OFF</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 text-black animate-bounce" />
                <span className="hidden sm:inline">INLINE-4 SCREAM</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2 bg-slate-800/80 p-1.5 rounded-full border border-slate-700">
            <button
              onClick={() => setSettings(s => ({ ...s, isLowLightTheme: false }))}
              className={`p-1.5 rounded-full transition-all ${!isLowLightTheme ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              title="Serene Purple Twilight Theme"
              id="theme-twilight-btn"
            >
              <Sun className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSettings(s => ({ ...s, isLowLightTheme: true }))}
              className={`p-1.5 rounded-full transition-all ${isLowLightTheme ? 'bg-green-500 text-black shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              title="Stealth Cyan Low-Light Theme"
              id="theme-stealth-btn"
            >
              <Moon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Grid Section */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Playfield column */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          
          {/* Audio warning help banner */}
          <div className="bg-slate-900 border border-green-950 p-4 rounded-xl flex items-center justify-between gap-4">
            <div className="flex items-start gap-2.5">
              <Compass className="w-5 h-5 text-green-400 shrink-0 mt-0.5 animate-spin" />
              <div className="text-xs text-slate-300">
                <span className="font-bold text-green-400 uppercase tracking-wider block mb-0.5">Screaming Engine Synth Enabled!</span>
                Tap the <strong className="text-white">INLINE-4 SCREAM</strong> button at the top right to unmute. Experience dynamic sawtooth oscillation matching 15k RPM gear changes!
              </div>
            </div>
            {!isAudioMuted && (
              <span className="text-[10px] bg-green-500/10 text-green-400 border border-green-800/50 px-2 py-1 rounded font-mono uppercase shrink-0">
                Synthesizer Live
              </span>
            )}
          </div>

          {/* Highway Simulation Canvas container wrapper */}
          <div
            ref={containerRef}
            id="highway-canvas"
            className={`relative w-full rounded-2xl border border-slate-800 overflow-hidden bg-slate-950 shadow-2xl transition-all duration-300 ${isFullscreen ? 'h-screen md:h-screen rounded-none border-none' : 'h-[25rem]'}`}
          >
            {/* Main high speed canvas */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full block touch-none cursor-crosshair select-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />

            {/* Dynamic Fullscreen Toggle Icon Button overlay */}
            <button
              onClick={toggleFullscreen}
              className="absolute bottom-4 right-4 z-40 p-2.5 rounded-xl bg-slate-950/90 hover:bg-slate-900 border border-slate-850 hover:border-slate-700 text-slate-300 hover:text-white transition-all shadow-xl flex items-center gap-1.5 backdrop-blur-md text-xs font-black font-mono uppercase tracking-wider select-none cursor-pointer"
              id="fullscreen-toggle-btn"
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-4 h-4 text-pink-500 animate-pulse" />
                  <span className="hidden sm:inline">Normal View</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4 text-cyan-400" />
                  <span className="hidden sm:inline">Fullscreen</span>
                </>
              )}
            </button>

            {/* In-game Overlay hud */}
            <div className="absolute inset-x-0 top-3 px-4 flex justify-between pointer-events-none">
              <div className="flex flex-col gap-1 bg-slate-950/85 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-800">
                <span className="text-[9px] text-slate-400 font-mono">TRACK LIGHT COUPLING</span>
                <span className="text-sm font-black font-mono text-green-400">
                  {gameStateRef.current.lightAlignment > 80 ? '⚡ PERFECT SYNC' : `${gameStateRef.current.lightAlignment}%`}
                </span>
              </div>

              <div className="flex flex-col gap-1 bg-slate-950/85 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-800 text-right">
                <span className="text-[9px] text-slate-400 font-mono">SOLO TIME SPRINT</span>
                <span className="text-sm font-black font-mono text-cyan-400">
                  RECORD SPEED TRACK
                </span>
              </div>
            </div>

            {/* Commentator Toast Overlay */}
            <AnimatePresence>
              {commentary && raceStatus !== 'finished' && (
                <motion.div
                  key={commentary.id}
                  initial={{ opacity: 0, y: -45, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -15, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 28 }}
                  className="absolute inset-x-0 top-[4.5rem] z-40 mx-auto max-w-[85%] md:max-w-lg pointer-events-none flex justify-center"
                >
                  <div className="flex flex-col gap-1 px-4 py-2.5 rounded-xl backdrop-blur-md bg-slate-950/90 border border-pink-500/30 relative overflow-hidden shadow-xl shadow-pink-500/10 w-full">
                    {/* Neon accent beam */}
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 animate-pulse" />
                    
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-5 h-5 rounded bg-pink-500/10 border border-pink-500/30">
                        <Radio className="w-3.5 h-3.5 text-pink-400 animate-pulse" />
                      </div>
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-pink-400 font-bold font-mono">
                          CO-PILOT ROCKETFEED
                        </span>
                        <span className="text-[8px] uppercase tracking-widest text-slate-500 font-mono ml-2">
                          // LIVE COMMENTARY
                        </span>
                      </div>
                    </div>

                    <p className="text-xs md:text-sm text-slate-100 font-sans tracking-tight pt-1 font-medium pl-1 leading-relaxed">
                      "{commentary.text}"
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Countdown Overlay */}
            <AnimatePresence>
              {countdown !== null && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.2 }}
                  className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/92 backdrop-blur-md z-30"
                >
                  <div className="mb-6 px-5 py-2.5 bg-cyan-950/85 border-2 border-cyan-500/50 rounded-2xl shadow-[0_0_20px_rgba(6,182,212,0.15)] animate-pulse flex flex-col items-center">
                    <span className="text-[10px] font-mono font-bold tracking-[0.3em] text-cyan-400 mb-1 uppercase">WARNING CORNERING DIRECTIVE</span>
                    <span className="text-base font-sans font-black tracking-widest text-white block uppercase">
                      focus on the circle!!!
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold tracking-[0.4em] text-fuchsia-400 animate-pulse mb-3">REV YOUR 399cc ENGINE</span>
                  <motion.span
                    key={countdown}
                    initial={{ scale: 0.1, opacity: 0 }}
                    animate={{ scale: 1.1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 220 }}
                    className="text-8xl font-mono font-black text-fuchsia-400 drop-shadow-[0_0_15px_#d946ef]"
                  >
                    {countdown}
                  </motion.span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Finished Modal */}
            <AnimatePresence>
              {raceStatus === 'finished' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/92 backdrop-blur-md z-30 px-6 text-center"
                >
                  <Award className="w-14 h-14 text-green-400 animate-bounce mb-3" />
                  <h3 className="text-2xl font-black text-white">Sprint Session Complete!</h3>
                  <p className="text-slate-400 text-sm max-w-sm mb-6 leading-relaxed">
                    You screamed across {raceDistance} meters of nocturnal highway streams! Max speed reached:{' '}
                    <strong className="text-cyan-400">{(gameStateRef.current.playerSpeed).toFixed(1)} km/h</strong>.
                  </p>

                  <div className="flex gap-3">
                    <button
                      onClick={resetGame}
                      className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-350 rounded-xl font-bold font-mono text-xs uppercase"
                      id="finish-reset-btn"
                    >
                      Paddock Reset
                    </button>
                    <button
                      onClick={startCountdown}
                      className="px-6 py-2 bg-green-500 hover:bg-green-400 text-black font-extrabold rounded-xl text-xs uppercase shadow-lg shadow-green-500/20"
                      id="finish-retry-btn"
                    >
                      Next Heat
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Idle State / Lobby */}
            {raceStatus === 'idle' && (
              <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center z-20 overflow-y-auto">
                <div className="absolute -inset-10 bg-green-500/10 blur-3xl rounded-full pointer-events-none" />
                <div className="max-w-xl w-full bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-2xl relative z-10 backdrop-blur-md">
                  
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <Activity className="w-8 h-8 text-cyan-400 animate-pulse" />
                    <Sparkles className="w-5 h-5 text-pink-500 animate-bounce" />
                  </div>
                  
                  <h3 className="text-xl font-extrabold tracking-tight text-white mb-1 uppercase">
                    Nocturne Hyperbike Levitation EV-X
                  </h3>
                  <p className="text-xs text-slate-400 font-mono tracking-widest mb-5">
                    PILOT PRE-FLIGHT BRIEFING & INSTRUMENT MANUAL
                  </p>

                  {/* Objective Card */}
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 text-left mb-4">
                    <div className="flex items-start gap-2.5">
                      <Zap className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-200 uppercase font-mono tracking-wider">Primary Objective</h4>
                        <p className="text-slate-350 text-[11px] leading-relaxed mt-1">
                          Steer your quantum-levitated sportbike directly onto the active <strong>neon filament lightpath</strong> on the asphalt. Continuous alignment boosts your <strong>SYNC metrics</strong>, multiplying acceleration up to maximum warp velocities.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Dual columns for controls representation */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5 text-left text-[11px]">
                    
                    {/* Keyboard column */}
                    <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 mb-2 border-b border-slate-800 pb-1.5">
                        <Keyboard className="w-4 h-4 text-cyan-400" />
                        <span className="font-bold text-slate-300 font-mono">1. KEYBOARD KEYS</span>
                      </div>
                      <ul className="space-y-2 text-slate-300">
                        <li className="flex items-center justify-between">
                          <span>Accelerate:</span>
                          <span className="flex gap-1">
                            <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded font-bold text-[10px] text-white">W</kbd>
                            <span className="text-slate-500">/</span>
                            <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded font-bold text-[10px] text-white">↑</kbd>
                          </span>
                        </li>
                        <li className="flex items-center justify-between">
                          <span>Brake / Decel:</span>
                          <span className="flex gap-1 items-center">
                            <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded font-bold text-[10px] text-white">S</kbd>
                            <span className="text-slate-500">/</span>
                            <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded font-bold text-[10px] text-white">↓</kbd>
                            <span className="text-slate-500">/</span>
                            <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded font-bold text-[9px] text-pink-400 border-pink-500/35 uppercase">Space</kbd>
                          </span>
                        </li>
                        <li className="flex items-center justify-between">
                          <span>Steer Left:</span>
                          <span className="flex gap-1">
                            <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded font-bold text-[10px] text-white">A</kbd>
                            <span className="text-slate-500">/</span>
                            <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded font-bold text-[10px] text-white">←</kbd>
                          </span>
                        </li>
                        <li className="flex items-center justify-between">
                          <span>Steer Right:</span>
                          <span className="flex gap-1">
                            <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded font-bold text-[10px] text-white">D</kbd>
                            <span className="text-slate-500">/</span>
                            <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded font-bold text-[10px] text-white">→</kbd>
                          </span>
                        </li>
                      </ul>
                    </div>

                    {/* Touch / Display UI instructions */}
                    <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 mb-2 border-b border-slate-800 pb-1.5">
                        <Activity className="w-4 h-4 text-pink-400" />
                        <span className="font-bold text-slate-300 font-mono">2. SCREEN CONTROLS</span>
                      </div>
                      <ul className="space-y-2 text-slate-300">
                        <li className="flex items-start gap-1 justify-between">
                          <span className="font-semibold text-pink-400">Throttle Handle:</span>
                          <span className="text-right text-[10px] text-slate-400">Click & speed twist repeatedly to rev to 16,000 RPM.</span>
                        </li>
                        <li className="flex items-start gap-1 justify-between">
                          <span className="font-semibold text-cyan-400">Steering Slider:</span>
                          <span className="text-right text-[10px] text-slate-400">Slide the analog cornering guide to balance alignments.</span>
                        </li>
                      </ul>
                    </div>

                  </div>

                  {/* Weather & Core condition warnings */}
                  <div className="flex gap-4 items-center justify-between text-[10px] text-slate-400 bg-slate-950/30 p-2.5 rounded-lg border border-slate-800/50 mb-3">
                    <div className="flex items-center gap-1.5 text-blue-400">
                      <CloudRain className="w-3.5 h-3.5" />
                      <span>RAIN WARNING: Wet surfaces reduce repulsor steering grip.</span>
                    </div>
                    <div className="flex items-center gap-1 text-pink-400">
                      <Flame className="w-3.5 h-3.5" />
                      <span>HEAT: Sprints expire stamina if redlined.</span>
                    </div>
                  </div>

                  {/* Primary Focus Directive Prompt */}
                  <div className="my-3 py-2 px-3 bg-cyan-950/60 border border-cyan-500/40 rounded-xl text-center shadow-lg shadow-cyan-500/5 animate-pulse">
                    <span className="text-[9px] font-mono font-bold tracking-[0.34em] text-cyan-400 uppercase block mb-0.5">ALIGNMENT CORE CRITICAL REQUEST</span>
                    <span className="text-xs font-black tracking-wide text-white font-sans uppercase">
                      ⚠️ focus on the circle!!!
                    </span>
                  </div>

                  {/* Play Command Trigger */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={startCountdown}
                      className="w-full py-3.5 bg-green-500 hover:bg-green-400 text-black font-black tracking-widest text-xs uppercase rounded-xl transition-all shadow-lg shadow-green-500/20 active:scale-95 flex items-center justify-center gap-2 hover:brightness-110"
                      id="start-race-overlay-btn"
                    >
                      🚀 INITIATE SYSTEM INJECTION & START
                    </button>
                    <span className="text-[9px] text-slate-500 font-mono">
                      (Pro-Tip: Pressing "W" or ArrowUp keyboard keys also initiates launch sequence instantly)
                    </span>
                  </div>

                </div>
              </div>
            )}
          </div>

          {/* Active Controllers Interface */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Steering Leaning controls card */}
            <div className={`p-4 rounded-xl border ${isLowLightTheme ? 'bg-slate-900/60 border-green-950' : 'bg-slate-900/95 border-slate-700'} flex flex-col gap-3`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold tracking-wider text-slate-400">CORNER LEAN & STEER</span>
                <span className="text-[10px] bg-slate-850 text-green-400 border border-green-950 px-2.5 py-0.5 rounded font-mono">
                  ACTIVE LEAN
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-1">
                  <button
                    onClick={() => steerAction('left')}
                    disabled={raceStatus !== 'racing'}
                    className="flex-1 py-3 text-center rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-700 text-xs font-mono disabled:opacity-40 uppercase"
                    id="steer-left-btn"
                  >
                    ◀ Lean Left
                  </button>
                  <button
                    onClick={() => steerAction('right')}
                    disabled={raceStatus !== 'racing'}
                    className="flex-1 py-3 text-center rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-700 text-xs font-mono disabled:opacity-40 uppercase"
                    id="steer-right-btn"
                  >
                    Lean Right ▶
                  </button>
                </div>

                <div className="mt-1">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono mb-1">
                    <span>Motorcycle Lean Drift Angle</span>
                    <span className="text-green-400">{Math.round(playerSteeringY)} degrees</span>
                  </div>
                  <input
                    type="range"
                    min="-45"
                    max="45"
                    value={targetSteeringY}
                    disabled={raceStatus !== 'racing'}
                    onChange={(e) => setTargetSteeringY(Number(e.target.value))}
                    className="w-full accent-green-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Throttle rev box */}
            <div className={`p-4 rounded-xl border ${isLowLightTheme ? 'bg-slate-900/60 border-green-950' : 'bg-slate-900/95 border-slate-700'} flex flex-col justify-between gap-3`}>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono font-bold tracking-wider text-slate-400">GESTURE THROTTLE ACCEL</span>
                  <span className="text-[10px] font-mono text-green-400 animate-pulse bg-green-950/40 px-2 py-0.5 rounded font-bold">
                    {playerRpm} RPM
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Click/tap the throttle handle consecutively to rev output up to 16,000 RPM. Synchronizing throttle bursts gives optimal exhaust acceleration!
                </p>
              </div>

              <button
                onClick={handleTouchThrottleBoost}
                disabled={raceStatus !== 'racing' && raceStatus !== 'idle'}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-green-600 to-cyan-600 hover:from-green-500 hover:to-cyan-500 text-black font-extrabold text-xs uppercase tracking-widest disabled:opacity-40 active:scale-95 transition-all shadow-md shadow-green-500/10"
                id="manual-pedal-boost-btn"
              >
                {raceStatus === 'idle' ? '✊ ACCELERATE TO START' : '✊ TWIST THROTTLE ACCEL'}
              </button>
            </div>

          </div>

          {/* Key shortcut bar */}
          <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-xl flex flex-wrap gap-4 items-center justify-between text-xs text-slate-400 font-mono transition-all duration-200">
            <span className="font-semibold flex items-center gap-1.5 text-slate-350">
              <Keyboard className="w-4 h-4 text-green-400" /> Active Keys:
            </span>
            
            {/* W / Up Arrow */}
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all duration-150 ${
              (activeKeysState['w'] || activeKeysState['arrowup'])
                ? 'bg-green-500/10 text-green-300 border-green-500 shadow-sm shadow-green-500/20 scale-105'
                : 'bg-slate-950/20 border-slate-800 text-slate-400'
            }`}>
              <kbd className="px-1 py-0.5 bg-slate-800/80 rounded border border-slate-705 text-[9px] font-bold">W</kbd>
              <span className="text-[10px]">/</span>
              <kbd className="px-1 py-0.5 bg-slate-800/80 rounded border border-slate-705 text-[9px] font-bold">↑</kbd>
              <span className="text-[10px] font-semibold">Throttle</span>
            </div>

            {/* S / Down Arrow */}
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all duration-150 ${
              (activeKeysState['s'] || activeKeysState['arrowdown'])
                ? 'bg-amber-500/10 text-amber-300 border-amber-500 shadow-sm shadow-amber-500/20 scale-105'
                : 'bg-slate-950/20 border-slate-800 text-slate-400'
            }`}>
              <kbd className="px-1 py-0.5 bg-slate-800/80 rounded border border-slate-705 text-[9px] font-bold">S</kbd>
              <span className="text-[10px]">/</span>
              <kbd className="px-1 py-0.5 bg-slate-800/80 rounded border border-slate-705 text-[9px] font-bold">↓</kbd>
              <span className="text-[10px] font-semibold">Rear Brake</span>
            </div>

            {/* A & Left / D & Right */}
            <div className="flex gap-2">
              <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border transition-all duration-150 ${
                (activeKeysState['a'] || activeKeysState['arrowleft'])
                  ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500 shadow-sm shadow-cyan-500/20 scale-105'
                  : 'bg-slate-950/20 border-slate-800 text-slate-400'
              }`}>
                <kbd className="px-1 py-0.5 bg-slate-800/80 rounded border border-slate-705 text-[9px] font-bold">A</kbd>
                <span className="text-[9px]">Steer L</span>
              </div>
              <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border transition-all duration-150 ${
                (activeKeysState['d'] || activeKeysState['arrowright'])
                  ? 'bg-purple-500/10 text-purple-300 border-purple-500 shadow-sm shadow-purple-500/20 scale-105'
                  : 'bg-slate-950/20 border-slate-800 text-slate-400'
              }`}>
                <kbd className="px-1 py-0.5 bg-slate-800/80 rounded border border-slate-705 text-[9px] font-bold">D</kbd>
                <span className="text-[9px]">Steer R</span>
              </div>
            </div>

            {/* Quantum Space Brake */}
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all duration-150 ${
              (activeKeysState[' '] || activeKeysState['spacebar'])
                ? 'bg-pink-500/15 text-pink-305 border-pink-500 shadow-sm shadow-pink-500/20 scale-105'
                : 'bg-slate-950/20 border-slate-800 text-slate-500'
            }`}>
              <kbd className="px-1.5 py-0.5 bg-slate-800/80 rounded border border-slate-705 text-[9px] font-bold uppercase text-[8px]">Space</kbd>
              <span className="text-[10px] font-semibold">Ultra Brake</span>
            </div>

          </div>

        </div>

        {/* Status Dashboard column */}
        <div className="flex flex-col gap-6">

          {/* Real-time statistics meter panel */}
          <div className={`p-5 rounded-2xl border ${
            isLowLightTheme
              ? 'bg-slate-950/80 border-green-950 shadow-xl'
              : 'bg-slate-900/60 border-slate-700'
          }`}>
            <h2 className="text-xs font-mono font-bold tracking-wider text-green-400 uppercase mb-4 pb-2 border-b border-white/5 flex items-center justify-between">
              <span>ZX TELEMETRY DASHBOARD</span>
              <span className="text-[9px] text-slate-400">INLINE-4 STATUS</span>
            </h2>

            <div className="grid grid-cols-2 gap-4">
              
              {/* Core Speed display */}
              <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] uppercase font-bold tracking-widest text-green-400 mb-1">
                  Speed
                </span>
                <div className="text-3xl font-mono font-black tracking-tight text-white flex items-baseline">
                  {gameStateRef.current.playerSpeed.toFixed(1)}
                </div>
                <span className="text-[9px] text-slate-500 font-mono">
                  KM/H
                </span>
              </div>

              {/* Core distance traveled */}
              <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] uppercase font-bold tracking-widest text-green-400 mb-1">
                  Distance
                </span>
                <div className="text-3xl font-mono font-black tracking-tight text-white">
                  {gameStateRef.current.distanceTraveled.toFixed(1)}
                </div>
                <span className="text-[9px] text-slate-500 font-mono">
                  METERS
                </span>
              </div>

            </div>

            {/* High speed gear indicator & Engine RPM tachometer */}
            <div className="mt-5 space-y-4">
              
              {/* Active gear ratio widget */}
              <div className="flex items-center justify-between bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                <span className="text-[11px] font-mono text-slate-400 uppercase font-bold">Transmission Gear</span>
                <span className="text-lg font-mono font-black text-green-400 bg-green-950 border border-green-800 px-3 py-0.5 rounded">
                  G{playerGear}
                </span>
              </div>

              {/* Dynamic Tachometer gauge */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-slate-400">TACHOMETER REVS</span>
                  <span className="text-green-400 font-bold">{playerRpm.toLocaleString()} RPM</span>
                </div>
                <div className="h-2 w-full bg-slate-850 rounded-full overflow-hidden relative">
                  <div
                    className={`h-full transition-all duration-100 ${
                      playerRpm > 12000
                        ? 'bg-rose-500 shadow-[0_0_10px_#f43f5e]' // redline alarm
                        : playerRpm > 7500
                        ? 'bg-green-400'
                        : 'bg-cyan-400'
                    }`}
                    style={{ width: `${(playerRpm / 16000) * 100}%` }}
                  />
                  {/* RPM alert zones */}
                  <div className="absolute right-0 top-0 bottom-0 w-1/5 border-l border-dashed border-red-500/50 bg-red-500/5" title="Redline zone" />
                </div>
              </div>

              {/* Stamina / Overheating telemetry bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-slate-400">AI CORE SYNAPSE FEEDBACK</span>
                  <span className="text-cyan-400 font-bold">{Math.round(stamina)}%</span>
                </div>
                <div className="h-2 w-full bg-slate-850 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      stamina > 70
                        ? 'bg-fuchsia-500 shadow-[0_0_8px_#d946ef]'
                        : stamina > 35
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${stamina}%` }}
                  />
                </div>
              </div>

            </div>

            {/* Dynamic Weather Conditions System */}
            <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono">
              <span className="flex items-center gap-1.5 font-bold">
                <CloudRain className="w-3.5 h-3.5 text-cyan-400" /> Weather Core:
              </span>
              <div className="flex bg-slate-900 rounded p-1 border border-slate-700/80 gap-1 select-none">
                <button
                  onClick={() => setWeather('clear')}
                  className={`px-2.5 py-0.5 rounded text-[10px] uppercase font-bold transition-all ${weather === 'clear' ? 'bg-cyan-500 text-black shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                  id="weather-clear-btn"
                >
                  Clear Outlook
                </button>
                <button
                  onClick={() => setWeather('rain')}
                  className={`px-2.5 py-0.5 rounded text-[10px] uppercase font-bold transition-all ${weather === 'rain' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                  id="weather-rain-btn"
                >
                  ☔ Light Rain
                </button>
              </div>
            </div>

            {/* Unreal Engine 5 Cinematic Camera view systems */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col gap-2 text-xs text-slate-400 font-mono">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-bold">
                  <Video className="w-3.5 h-3.5 text-pink-400" /> Camera Angle:
                </span>
                <div className="flex bg-slate-900 rounded p-1 border border-slate-700/80 gap-1 select-none">
                  <button
                    onClick={() => setCameraAngle('cinematic')}
                    className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold transition-all ${cameraAngle === 'cinematic' ? 'bg-pink-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                    id="cam-cinematic-btn"
                  >
                    Cinematic
                  </button>
                  <button
                    onClick={() => setCameraAngle('low-angle')}
                    className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold transition-all ${cameraAngle === 'low-angle' ? 'bg-cyan-500 text-black shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                    id="cam-lowangle-btn"
                  >
                    Low-Angle
                  </button>
                  <button
                    onClick={() => setCameraAngle('warp')}
                    className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold transition-all ${cameraAngle === 'warp' ? 'bg-amber-500 text-black shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                    id="cam-warp-btn"
                  >
                    Warp
                  </button>
                </div>
              </div>

              {/* Raytracing switch */}
              <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-800/40">
                <span className="flex items-center gap-1.5 font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Raytraced Road:
                </span>
                <button
                  onClick={() => setRaytraced(r => !r)}
                  className={`px-2.5 py-0.5 rounded text-[9px] uppercase font-extrabold transition-all border ${raytraced ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white border-amber-500 shadow-sm shadow-amber-500/10' : 'bg-slate-900 text-slate-500 border-slate-850 hover:text-slate-350'}`}
                  id="raytracing-toggle-btn"
                >
                  {raytraced ? '● RT ACTIVE (UE5)' : '○ RT OFF'}
                </button>
              </div>
            </div>

            {/* Track course selector */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>Track Distance:</span>
              <select
                disabled={raceStatus === 'racing' || raceStatus === 'countdown'}
                value={raceDistance}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setRaceDistance(val);
                  setSettings(s => ({ ...s, totalDistance: val }));
                }}
                className="bg-slate-900 text-slate-200 px-2 py-1 rounded border border-slate-700 text-xs font-mono"
              >
                <option value="500">Short Drag Circuit (500m)</option>
                <option value="1000">Nocturne Sprint (1000m)</option>
                <option value="2500">Enduro Marathon (2500m)</option>
                <option value="3500">Hyperway Odyssey (3500m)</option>
                <option value="5000">Starry Grand Prix (5000m)</option>
                <option value="10000">Infinite Megalopolis (10000m)</option>
              </select>
            </div>
          </div>

          {/* Trigger controls */}
          <div className="flex gap-2">
            {raceStatus === 'racing' ? (
              <button
                onClick={() => {
                  setRaceStatus('idle');
                  gameStateRef.current.status = 'idle';
                  engineSynthRef.current?.stop();
                }}
                className="flex-1 py-3 px-4 bg-slate-850 hover:bg-slate-800 text-amber-400 rounded-xl font-bold font-mono text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 border border-slate-700"
                id="pause-race-btn"
              >
                <Pause className="w-4 h-4" /> Pause Session
              </button>
            ) : (
              <button
                onClick={startCountdown}
                disabled={raceStatus === 'countdown'}
                className="flex-1 py-3 px-4 bg-green-500 hover:bg-green-400 text-black rounded-xl font-black font-sans text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/10"
                id="resume-start-race-btn"
              >
                <Play className="w-4 h-4" /> {raceStatus === 'idle' ? 'LAUNCH SPRINT' : 'RESUME SPRINT'}
              </button>
            )}

            <button
              onClick={resetGame}
              className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs uppercase transition-all border border-slate-700"
              title="Reset Paddock metrics"
              id="global-reset-btn"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Rule Selector Widgets tabs */}
          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 text-xs">
            <div className="flex border-b border-slate-800 pb-2 mb-2">
              <button
                className={`pb-1 px-2 font-bold uppercase tracking-wider ${activeTab === 'play' ? 'text-green-400 border-b-2 border-green-400' : 'text-slate-500'}`}
                onClick={() => setActiveTab('play')}
              >
                Sim Rules
              </button>
              <button
                className={`pb-1 px-2 font-bold uppercase tracking-wider ${activeTab === 'diy-guide' ? 'text-green-400 border-b-2 border-green-400' : 'text-slate-500'}`}
                onClick={() => setActiveTab('diy-guide')}
              >
                ZX Specs
              </button>
            </div>

            {activeTab === 'play' ? (
              <ul className="space-y-2 text-slate-400">
                <li className="flex items-start gap-1.5">
                  <span className="text-green-400 font-bold">•</span>
                  <span><strong>Throttle Revs</strong>: Maintain high throttle by holding keyboard W or Up-Arrow. Rev high to shift gears!</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-green-400 font-bold">•</span>
                  <span><strong>Neon Alignment Bonus</strong>: Ensure you steer and match the glowing dynamic path. Synchronizing correctly gives a massive acceleration boost.</span>
                </li>
              </ul>
            ) : (
              <ul className="space-y-2 text-slate-400">
                <li className="flex items-start gap-1.5">
                  <span className="text-cyan-400 font-bold">•</span>
                  <span><strong>Inline-4 engine</strong>: Featuring a high-revving 399cc double overhead cam architecture redlining at 16,000 RPM.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-cyan-400 font-bold">•</span>
                  <span><strong>Web Audio Harmony</strong>: Dynamic sawtooth oscillation pitch correlates directly to active speed and transmission gears.</span>
                </li>
              </ul>
            )}
          </div>

        </div>

      </div>

      {/* Styled Footer */}
      <footer className="z-10 bg-slate-950/80 backdrop-blur-md border-t border-white/5 py-3 px-6 flex flex-wrap justify-between items-center gap-4 text-xs text-slate-500 font-mono">
        <div>
          <span>HIGH SPEED RACING MOTORCYCLE SIMULATION</span>
        </div>
        <div className="flex gap-4">
          <span>HIGH FREQUENCY ANIMATION: ACTIVE</span>
          <span>LATENCY: &lt; 1.5MS</span>
        </div>
      </footer>
    </div>
  );
}
