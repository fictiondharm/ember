import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { useFleet } from '../store/FleetContext';
import { cn } from '../lib/format';

interface ElevenLabsVoiceAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  truckId?: string;
  driverName?: string;
}

const DEFAULT_ELEVENLABS_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel

const ELEVENLABS_VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel (Clear & Professional)' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (Deep & Authoritative)' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni (Dynamic Narration)' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella (Warm Dispatcher)' },
];

const QUICK_VOICE_COMMANDS = [
  {
    label: '🚚 Book 8T Auto Parts to Chennai',
    text: 'Book 8 tonnes of automotive components from Bengaluru to Chennai',
  },
  {
    label: '📦 Book 5T Electronics from Hosur',
    text: 'Book 5 tonnes of electronics from Hosur to Chennai',
  },
  {
    label: '🚨 Report Emergency SOS Breakdown',
    text: 'Emergency SOS: Truck engine failure and smoke near Hosur highway km 42',
  },
  {
    label: '📍 Query Truck FG-027 Status',
    text: 'What is the current status and location of truck FG-027?',
  },
];

export function ElevenLabsVoiceAssistant({
  isOpen,
  onClose,
  truckId = 'FG-027',
  driverName = 'Driver',
}: ElevenLabsVoiceAssistantProps) {
  const { snapshot, refresh } = useFleet();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('ELEVENLABS_API_KEY') || '');
  const [voiceId, setVoiceId] = useState(DEFAULT_ELEVENLABS_VOICE_ID);
  const [showSettings, setShowSettings] = useState(false);
  const [engineUsed, setEngineUsed] = useState<'ELEVENLABS' | 'BROWSER_TTS'>('BROWSER_TTS');

  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize Web Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-IN'; // English (India) with support for Indian accents

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognition.onerror = (event: any) => {
        console.warn('[VoiceAssistant] Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('ELEVENLABS_API_KEY', key);
  };

  const startListening = () => {
    setTranscript('');
    setAiResponse(null);
    if (audioRef.current) audioRef.current.pause();
    window.speechSynthesis?.cancel();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.warn('Recognition already started or error:', err);
      }
    } else {
      alert('Speech Recognition is not supported by this browser. Please use the quick command chips below.');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListening(false);
    if (transcript.trim()) {
      void processVoiceCommand(transcript);
    }
  };

  // Speaks text using ElevenLabs API (or falls back to Browser Speech Synthesis)
  const speakText = async (text: string) => {
    setIsSpeaking(true);

    if (apiKey && apiKey.trim().length > 10) {
      try {
        setEngineUsed('ELEVENLABS');
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey.trim(),
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.8,
            },
          }),
        });

        if (response.ok) {
          const blob = await response.blob();
          const audioUrl = URL.createObjectURL(blob);
          const audio = new Audio(audioUrl);
          audioRef.current = audio;
          audio.onended = () => setIsSpeaking(false);
          audio.onerror = () => {
            fallbackSpeech(text);
          };
          await audio.play();
          return;
        } else {
          console.warn('[ElevenLabs] API returned status', response.status, 'falling back to Browser TTS');
        }
      } catch (err) {
        console.warn('[ElevenLabs] Fetch error:', err);
      }
    }

    // High quality Browser Speech Synthesis Fallback
    fallbackSpeech(text);
  };

  const fallbackSpeech = (text: string) => {
    setEngineUsed('BROWSER_TTS');
    if (!('speechSynthesis' in window)) {
      setIsSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const englishVoice =
      voices.find((v) => v.lang === 'en-IN') ||
      voices.find((v) => v.lang.startsWith('en')) ||
      voices[0];
    if (englishVoice) utterance.voice = englishVoice;

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  // Parses voice commands and executes authoritative state updates
  const processVoiceCommand = async (commandText: string) => {
    setIsProcessing(true);
    const text = commandText.toLowerCase();

    try {
      // 1. EMERGENCY SOS / INCIDENT
      if (text.includes('emergency') || text.includes('sos') || text.includes('breakdown') || text.includes('accident') || text.includes('smoke')) {
        let loc = 'Hosur NH-48 Highway km 42';
        if (text.includes('bangalore') || text.includes('bengaluru')) loc = 'Bengaluru Electronic City Flyover';
        if (text.includes('krishnagiri')) loc = 'Krishnagiri Toll Plaza NH-48';
        if (text.includes('chennai')) loc = 'Sriperumbudur Industrial Corridor';

        await api.createIncident({
          truckId: truckId || 'FG-027',
          type: text.includes('accident') ? 'ACCIDENT' : 'TRUCK_BREAKDOWN',
          location: loc,
          severity: 'CRITICAL',
          description: `🚨 CRITICAL EMERGENCY SOS: Driver ${driverName} reported via ElevenLabs voice beacon: "${commandText}"`,
        });

        const reply = `Emergency SOS beacon activated for truck ${truckId || 'FG-027'} near ${loc}. Control Tower has dispatched emergency recovery and reroute protocol.`;
        setAiResponse(reply);
        await refresh();
        await speakText(reply);
        return;
      }

      // 2. FREIGHT BOOKING VIA VOICE
      if (text.includes('book') || text.includes('ship') || text.includes('load') || text.includes('transport')) {
        // Extract Weight
        const weightMatch = text.match(/(\d+(\.\d+)?)\s*(ton|tonne|t\b)/i);
        const weightT = weightMatch && weightMatch[1] ? parseFloat(weightMatch[1]) : 6.0;

        // Extract Origin & Destination
        let origin = 'Bengaluru';
        let destination = 'Chennai';

        if (text.includes('hosur to chennai') || (text.includes('from hosur') && text.includes('chennai'))) {
          origin = 'Hosur';
          destination = 'Chennai';
        } else if (text.includes('krishnagiri to chennai')) {
          origin = 'Krishnagiri';
          destination = 'Chennai';
        } else if (text.includes('bengaluru to hosur')) {
          origin = 'Bengaluru';
          destination = 'Hosur';
        }

        // Extract Cargo Name
        let cargoName = 'Automotive Components';
        if (text.includes('electronics') || text.includes('phone')) cargoName = 'Consumer Electronics';
        if (text.includes('cement') || text.includes('steel') || text.includes('iron')) cargoName = 'Industrial Steel & Construction Cargo';
        if (text.includes('fmcg') || text.includes('food') || text.includes('grocery')) cargoName = 'Packaged FMCG Goods';
        if (text.includes('pharma') || text.includes('medicine')) cargoName = 'Pharmaceutical Supplies';

        const shipper = snapshot.organizations.find((o) => o.type === 'SHIPPER') || snapshot.organizations[0];
        const shipperId = shipper?.id || 'org_abc_distributors';

        const matchedOffer = snapshot.capacityOffers.find(
          (o) => o.origin === origin && o.destination === destination && o.availableT >= weightT,
        ) || snapshot.capacityOffers[0];

        const shipmentRes = await api.createShipment({
          shipperId,
          cargoName,
          weightT,
          origin,
          destination,
          ...(matchedOffer ? { capacityOfferId: matchedOffer.id } : {}),
        });

        const confirmedId = shipmentRes.shipment?.id || 'SHP-NEW';
        const assignedTruck = shipmentRes.shipment?.truckId || truckId || 'FG-027';

        const reply = `Booking confirmed! Reserved ${weightT} tonnes of ${cargoName} from ${origin} to ${destination} on truck ${assignedTruck}. Shipment reference ${confirmedId}. Status is capacity reserved.`;
        setAiResponse(reply);
        await refresh();
        await speakText(reply);
        return;
      }

      // 3. STATUS QUERY
      if (text.includes('status') || text.includes('location') || text.includes('where')) {
        const tr = snapshot.trucks.find((t) => t.id === truckId) || snapshot.trucks[0];
        const assigned = snapshot.shipments.filter((s) => s.truckId === tr?.id && s.status !== 'DELIVERED');

        let reply = `Truck ${tr?.id || truckId || 'FG-027'} is currently ${tr?.status || 'AVAILABLE'} on route ${tr?.origin || 'Bengaluru'} to ${tr?.destination || 'Chennai'}. Available spare capacity is ${tr?.availableT ?? 0} tonnes.`;
        if (assigned.length > 0 && assigned[0]) {
          reply += ` Carrying active shipment ${assigned[0].cargoName} (${assigned[0].weightT} tonnes).`;
        }
        setAiResponse(reply);
        await speakText(reply);
        return;
      }

      // 4. GENERAL DISPATCH ASSISTANT
      const fallbackReply = `Acknowledged: "${commandText}". FleetGrid AI Voice Co-Pilot is connected to your cab. You can say "Book 8 tonnes auto parts to Chennai" or "Emergency SOS breakdown near Hosur".`;
      setAiResponse(fallbackReply);
      await speakText(fallbackReply);
    } catch (err) {
      const errorMsg = `Unable to complete request: ${(err as Error).message}`;
      setAiResponse(errorMsg);
      await speakText(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickCommand = (cmdText: string) => {
    setTranscript(cmdText);
    void processVoiceCommand(cmdText);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-base-950/80 p-4 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl rounded-2xl border border-accent/40 bg-base-900 shadow-[0_20px_70px_rgba(0,0,0,0.8)] overflow-hidden">
        {/* Glow Header */}
        <div className="relative border-b border-base-700 bg-base-850 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20 border border-accent/40 text-accent">
              <span className="text-xl">🎙️</span>
              {isListening && (
                <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-danger animate-ping" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-mono text-sm font-bold text-ink-50">
                  ElevenLabs AI Voice Co-Pilot
                </h3>
                <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 font-mono text-3xs font-semibold text-accent">
                  Cab & Booking
                </span>
              </div>
              <p className="text-2xs text-ink-400">
                Driver Cab: <span className="font-mono text-ink-200">{truckId}</span> ({driverName})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className="rounded-lg border border-base-700 bg-base-900 p-2 text-ink-400 hover:text-ink-100 hover:border-base-600 transition-colors cursor-pointer"
              title="ElevenLabs Settings"
            >
              ⚙️
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-base-700 bg-base-900 p-2 text-ink-400 hover:text-ink-100 hover:border-base-600 transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ElevenLabs API Settings Panel */}
        {showSettings && (
          <div className="border-b border-base-700 bg-base-950 p-4 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-semibold uppercase tracking-wider text-ink-300">
                ElevenLabs Neural Voice Configuration
              </span>
              <span className="text-3xs text-healthy">Optional / Auto-fallback active</span>
            </div>
            <div className="space-y-2">
              <label className="block text-3xs uppercase text-ink-400">ElevenLabs API Key</label>
              <input
                type="password"
                placeholder="Enter xi-api-key (e.g. 8fa7...)"
                value={apiKey}
                onChange={(e) => saveApiKey(e.target.value)}
                className="w-full rounded-md border border-base-700 bg-base-900 px-3 py-1.5 text-xs text-ink-100 focus:border-accent focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-3xs uppercase text-ink-400">ElevenLabs Voice Model</label>
              <select
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
                className="w-full rounded-md border border-base-700 bg-base-900 px-3 py-1.5 text-xs text-ink-100 focus:border-accent focus:outline-none cursor-pointer"
              >
                {ELEVENLABS_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between text-3xs text-ink-500">
              <span>Model: Multilingual v2</span>
              <span>Audio: MP3 44.1kHz</span>
            </div>
          </div>
        )}

        {/* Voice Visualizer / Microphone Centerpiece */}
        <div className="p-6 text-center space-y-5">
          {/* Animated Waveform Visualizer */}
          <div className="mx-auto flex h-24 w-full max-w-sm items-center justify-center gap-1.5 rounded-xl border border-base-800 bg-base-950/70 p-4">
            {[40, 75, 55, 90, 60, 100, 70, 85, 45, 95, 65, 80, 50, 70].map((h, i) => (
              <span
                key={i}
                className={cn(
                  'w-1.5 rounded-full transition-all duration-150',
                  isListening
                    ? 'bg-danger animate-pulse'
                    : isSpeaking
                    ? 'bg-accent animate-bounce'
                    : isProcessing
                    ? 'bg-warn animate-pulse'
                    : 'bg-base-700',
                )}
                style={{
                  height: isListening || isSpeaking ? `${(h * (isSpeaking ? 0.9 : 0.7)).toFixed(0)}%` : '15%',
                  animationDelay: `${i * 60}ms`,
                }}
              />
            ))}
          </div>

          {/* Status Label */}
          <div>
            <div className="font-mono text-xs font-semibold uppercase tracking-wider">
              {isListening ? (
                <span className="text-danger flex items-center justify-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-danger animate-ping" />
                  Listening to your microphone… Speak now!
                </span>
              ) : isProcessing ? (
                <span className="text-warn flex items-center justify-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-warn animate-spin" />
                  Processing voice intent & executing API state…
                </span>
              ) : isSpeaking ? (
                <span className="text-accent flex items-center justify-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                  {engineUsed === 'ELEVENLABS' ? 'ElevenLabs Neural TTS Voice Speaking…' : 'AI Voice Assistant Speaking…'}
                </span>
              ) : (
                <span className="text-ink-400">Press the microphone to speak or click a command below</span>
              )}
            </div>

            {/* Transcript Preview */}
            {transcript && (
              <div className="mt-3 rounded-lg border border-base-700 bg-base-850 p-3 font-mono text-xs text-ink-200">
                <span className="text-ink-500 font-bold uppercase text-3xs block mb-1">Spoken Voice Transcript:</span>
                "{transcript}"
              </div>
            )}

            {/* AI Confirmation Reply */}
            {aiResponse && (
              <div className="mt-3 rounded-lg border border-healthy/40 bg-healthy/10 p-3 font-mono text-xs text-healthy text-left">
                <div className="flex items-center gap-1.5 text-3xs font-bold uppercase tracking-wider text-healthy mb-1">
                  <span>✓ Action Executed & Confirmed</span>
                  <span className="ml-auto text-ink-400 font-normal">
                    Engine: {engineUsed === 'ELEVENLABS' ? 'ElevenLabs Neural' : 'Speech Engine'}
                  </span>
                </div>
                {aiResponse}
              </div>
            )}
          </div>

          {/* Main Action Push-To-Talk Button */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={isListening ? stopListening : startListening}
              className={cn(
                'group relative flex h-16 w-16 items-center justify-center rounded-full text-2xl shadow-xl transition-all active:scale-95 cursor-pointer',
                isListening
                  ? 'bg-danger text-white shadow-danger/40 ring-4 ring-danger/30'
                  : 'bg-accent text-base-950 shadow-accent/40 hover:bg-accent/90 ring-4 ring-accent/20',
              )}
            >
              {isListening ? '⏹️' : '🎙️'}
            </button>
          </div>
          <div className="text-3xs font-mono text-ink-500">
            {isListening ? 'Tap to Stop & Execute' : 'Tap to Start Voice Recognition'}
          </div>

          {/* Quick Voice Command Chips */}
          <div className="pt-2 border-t border-base-800 text-left">
            <span className="font-mono text-3xs font-semibold uppercase tracking-wider text-ink-400 block mb-2">
              Quick Driver & Booking Commands (One-Tap Test):
            </span>
            <div className="grid gap-2 sm:grid-cols-2">
              {QUICK_VOICE_COMMANDS.map((cmd) => (
                <button
                  key={cmd.label}
                  type="button"
                  onClick={() => handleQuickCommand(cmd.text)}
                  className="rounded-lg border border-base-700 bg-base-850 p-2.5 text-left text-xs font-mono text-ink-300 transition-all hover:border-accent hover:bg-base-800 hover:text-ink-100 cursor-pointer"
                >
                  <div className="font-semibold text-ink-100">{cmd.label}</div>
                  <div className="mt-0.5 truncate text-3xs text-ink-500">{cmd.text}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="border-t border-base-800 bg-base-950/80 px-6 py-2.5 text-center font-mono text-3xs text-ink-500 flex items-center justify-between">
          <span>ElevenLabs Speech Model: Multilingual v2</span>
          <span>Automatic Web Speech API Fallback</span>
        </div>
      </div>
    </div>
  );
}
