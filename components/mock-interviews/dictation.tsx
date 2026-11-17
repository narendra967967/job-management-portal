"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

// Speak instead of type: the browser's built-in speech recognition (Web Speech
// API) turns speech into text in the answer box, where the candidate can fix it
// before pressing Send. Chrome, Edge and Safari support it; each sends the audio
// to its maker's speech service (Google, Microsoft, Apple). Firefox doesn't, so
// the button isn't shown there. No key, no package, nothing reaches our server
// until the candidate sends the text.

// Minimal typing: TypeScript's DOM library doesn't declare the constructor.
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: SpeechRecognitionResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** English variant for recognition: the browser's own if it's English (en-IN, en-GB…), else US English. */
function speechLang(): string {
  const l = typeof navigator !== "undefined" ? navigator.language : "";
  return /^en(-|$)/i.test(l) ? l : "en-US";
}

const ERRORS: Record<string, [string, string]> = {
  "not-allowed": ["Microphone blocked", "Allow the microphone for this site in your browser's settings, then try again."],
  "service-not-allowed": ["Speech to text isn't available", "Your browser's speech service is turned off. You can still type your answer."],
  "audio-capture": ["No microphone found", "Check that a microphone is connected and not used by another app."],
  network: ["Speech to text needs the internet", "Your browser converts speech online. Check your connection and try again."],
};

/**
 * Dictation into a text value. `text` is the current value; `onText` receives
 * the value with what was said appended (interim words included, so they show
 * as they're spoken). `max` caps the length.
 */
export function useDictation({ text, onText, max }: { text: string; onText: (v: string) => void; max: number }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const wanted = useRef(false); // the user still wants to listen (Chrome stops by itself after a pause)
  const base = useRef(""); // the text before this round of speech
  const finals = useRef(""); // finished phrases from this round
  const latest = useRef({ text, onText, max });
  latest.current = { text, onText, max };

  useEffect(() => setSupported(!!recognitionCtor()), []);

  const stop = useCallback(() => {
    wanted.current = false;
    rec.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = speechLang();
    r.continuous = true;
    r.interimResults = true;
    const t = latest.current.text;
    base.current = t && !/\s$/.test(t) ? `${t} ` : t;
    finals.current = "";

    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const phrase = e.results[i][0].transcript;
        if (e.results[i].isFinal) finals.current += phrase.trim() + " ";
        else interim += phrase;
      }
      const next = (base.current + finals.current + interim).slice(0, latest.current.max);
      latest.current.onText(next);
    };
    r.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      const [title, desc] = ERRORS[e.error] ?? ["Speech to text stopped", "Try again, or type your answer."];
      toast.error(title, desc);
      wanted.current = false;
      setListening(false);
    };
    r.onend = () => {
      // Chrome ends a session after a pause; carry on while the user hasn't stopped.
      if (wanted.current) {
        base.current = (base.current + finals.current).slice(0, latest.current.max);
        finals.current = "";
        try {
          r.start();
          return;
        } catch {
          /* fall through to stopped */
        }
      }
      setListening(false);
    };

    rec.current = r;
    wanted.current = true;
    try {
      r.start();
      setListening(true);
    } catch {
      wanted.current = false;
      toast.error("Speech to text didn't start", "Try again, or type your answer.");
    }
  }, []);

  useEffect(() => () => {
    wanted.current = false;
    rec.current?.abort();
  }, []);

  return { supported, listening, start, stop, toggle: () => (wanted.current ? stop() : start()) };
}

/** The mic button beside Send. Renders nothing where the browser can't do speech to text. */
export function DictationButton({
  dictation,
  disabled,
}: {
  dictation: ReturnType<typeof useDictation>;
  disabled?: boolean;
}) {
  if (!dictation.supported) return null;
  const { listening, toggle } = dictation;
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      aria-pressed={listening}
      aria-label={listening ? "Stop speaking" : "Speak your answer"}
      title={listening ? "Stop speaking" : "Speak your answer"}
      className={cn(
        "relative inline-flex size-11 shrink-0 items-center justify-center rounded-lg border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50 sm:size-9",
        listening ? "border-rose-300 bg-rose-50 text-rose-700" : "bg-white/60 text-muted-foreground hover:text-foreground",
      )}
    >
      {listening ? <MicOff className="size-4" aria-hidden /> : <Mic className="size-4" aria-hidden />}
      {listening && (
        <span className="absolute -top-0.5 -right-0.5 flex size-2.5" aria-hidden>
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-rose-400 opacity-75 motion-reduce:hidden" />
          <span className="relative inline-flex size-2.5 rounded-full bg-rose-500" />
        </span>
      )}
    </button>
  );
}
