import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  Mic,
  MicOff,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Notice, PageTitle } from "./components";
import { useApp } from "./context";
import { offlineGuideReply } from "./offline-guide";

const specialties = ["General care", "Dentistry", "Surgery", "Paediatrics", "Women’s health"];

type VoiceMessage = { role: "user" | "assistant"; content: string };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function localConversationReply(question: string, firstName: string) {
  const name = firstName ? `, ${firstName}` : "";
  if (/\bhow are you\b|\bhow are things\b/i.test(question)) {
    return `I’m doing well, thanks for asking${name}. How are you feeling today?`;
  }
  if (/^(?:i(?:['’]m| am)|im)?\s*(?:fine|good|okay|ok|great|well|not bad)\b[!.?,\s]*$/i.test(question.trim())) {
    return `I’m glad to hear that${name}. Is there anything about your health or an upcoming visit you would like help with?`;
  }
  if (/^(hi|hello|hey|good morning|good afternoon|good evening)[!.?,\s]*$/i.test(question.trim())) {
    return `Hi${name}! How are you doing today? You can tell me what you would like help with.`;
  }
  return offlineGuideReply(question);
}

function speechReadyText(text: string) {
  return text
    .replace(/\n\nSource:.*$/s, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function OnlineVisitDemo() {
  const location = useLocation();
  const { user } = useApp();
  const requestedSpecialty = (location.state as { specialty?: string } | null)?.specialty;
  const topicOptions = requestedSpecialty && !specialties.includes(requestedSpecialty)
    ? [requestedSpecialty, ...specialties]
    : specialties;
  const firstName = user?.name.trim().split(/\s+/)[0] || "";
  const [specialty, setSpecialty] = useState(requestedSpecialty || specialties[0]);
  const [delayMinutes, setDelayMinutes] = useState(1);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const messagesRef = useRef<VoiceMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const displayTime = remaining === null
    ? ""
    : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;

  useEffect(() => {
    if (remaining === null || remaining === 0) return;
    const timer = window.setTimeout(() => setRemaining(remaining - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);

  useEffect(() => {
    if (remaining !== 0 || joined) return;
    const autoJoin = window.setTimeout(joinSession, 150);
    return () => window.clearTimeout(autoJoin);
  }, [remaining, joined, specialty, firstName, voices]);

  useEffect(() => {
    const synthesis = window.speechSynthesis;
    if (!synthesis) return;
    const updateVoices = () => setVoices(synthesis.getVoices());
    updateVoices();
    synthesis.addEventListener("voiceschanged", updateVoices);
    return () => synthesis.removeEventListener("voiceschanged", updateVoices);
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  function updateMessages(next: VoiceMessage[]) {
    messagesRef.current = next;
    setMessages(next);
  }

  useEffect(() => () => {
    recognition.current?.stop();
    window.speechSynthesis?.cancel();
  }, []);

  function speak(text: string) {
    if (!("speechSynthesis" in window)) {
      setVoiceError("Spoken replies are not supported in this browser. The reply is still shown as text.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(speechReadyText(text));
    const englishVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("en"));
    const selectedVoice = englishVoices.find((voice) => /natural/i.test(voice.name))
      || englishVoices.find((voice) => voice.lang.toLowerCase() === "en-ng")
      || englishVoices.find((voice) => voice.lang.toLowerCase().startsWith("en-gb"))
      || englishVoices[0];
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
    } else {
      utterance.lang = "en-NG";
    }
    utterance.rate = 0.96;
    utterance.pitch = 1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setVoiceError("");
    window.speechSynthesis.speak(utterance);
  }

  function respondTo(question: string) {
    const cleanQuestion = question.trim().slice(0, 2000);
    if (!cleanQuestion) return;

    const next = [...messagesRef.current, { role: "user" as const, content: cleanQuestion }];
    updateMessages(next);
    setDraft("");
    setVoiceError("");
    const answer = localConversationReply(cleanQuestion, firstName);
    updateMessages([...next, { role: "assistant", content: answer }]);
    speak(answer);
  }

  function startVoice() {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    if (speaking) window.speechSynthesis?.cancel();
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError("Voice input is not supported in this browser. You can type your message instead.");
      return;
    }
    setVoiceError("");
    const instance = new SpeechRecognition();
    instance.lang = "en-NG";
    instance.interimResults = false;
    instance.maxAlternatives = 1;
    instance.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) void respondTo(transcript);
      else setVoiceError("I didn’t catch that. Please try again or type your message.");
    };
    instance.onerror = (event) => {
      const errors: Record<string, string> = {
        "not-allowed": "Chrome refused the microphone. Confirm Microphone is Allow for this exact localhost address and that Windows lets desktop apps use the mic.",
        "service-not-allowed": "Chrome’s speech recognition service is blocked by a browser or device policy. You can type instead.",
        "audio-capture": "No microphone was detected. Check Windows Sound → Input and try again.",
        network: "The browser speech service could not connect. Check your internet connection or type instead.",
        "no-speech": "I didn’t hear speech. Check that the mic isn’t muted and try again.",
      };
      setVoiceError(errors[event.error || ""] || "Voice input could not start. You can type your message instead.");
      setListening(false);
    };
    instance.onend = () => setListening(false);
    recognition.current = instance;
    setListening(true);
    try {
      instance.start();
    } catch {
      setListening(false);
      setVoiceError("The microphone could not start. Check this site’s permission and try again.");
    }
  }

  function joinSession() {
    const greeting = firstName
      ? `Hi ${firstName}, welcome. I’m the AERIX demo health guide for ${specialty}. How are you doing today?`
      : `Hi, welcome. I’m the AERIX demo health guide for ${specialty}. How are you doing today?`;
    setJoined(true);
    updateMessages([{ role: "assistant", content: `${greeting} I’m an AI guide, not a doctor, and I can share general information but can’t diagnose or prescribe.` }]);
    speak(greeting);
  }

  return (
    <>
      <PageTitle
        eyebrow="ONLINE VISIT PREVIEW · DEMO"
        title={joined ? "Your AERIX voice session" : "Talk with the AERIX health guide."}
        description={joined
        ? "Speak one turn at a time. The guide will answer aloud and keep the conversation here in Appointments."
          : "Choose a topic and short demo wait. When it ends, the guide greets you by name and starts a voice conversation."}
        action={<Link className="button outline" to="/appointments"><ArrowLeft size={16}/> Back to appointments</Link>}
      />
      <section className="care-start-panel online-visit-demo">
        <Notice>
          Demo only: this is not a live doctor or confirmed appointment. It cannot diagnose or prescribe. Chrome’s speech recognition may process microphone audio; in offline mode, AERIX keeps the text conversation on this page.
        </Notice>
        {!joined && remaining === null && <>
          <label className="form-stack">
            Topic
            <select value={specialty} onChange={(event) => setSpecialty(event.target.value)}>
              {topicOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <h2><Clock3 size={20}/> Demo waiting time</h2>
          <div className="date-shortcuts" aria-label="Choose demo wait time">
            {[1, 2].map((minutes) => (
              <button type="button" key={minutes} className={delayMinutes === minutes ? "selected" : ""} onClick={() => setDelayMinutes(minutes)}>
                {minutes} minute{minutes === 1 ? "" : "s"}
              </button>
            ))}
          </div>
          <button className="button primary" type="button" onClick={() => setRemaining(delayMinutes * 60)}>
            <Sparkles size={17}/> Start demo session <ArrowRight size={16}/>
          </button>
          <p className="muted">The timer does not save or send health information. This quick preview does not reserve an appointment with a real clinician.</p>
        </>}
        {!joined && remaining !== null && <div className="online-visit-countdown" role="status" aria-live="polite">
          <span className="feature-icon violet"><Clock3 size={22}/></span>
          {remaining > 0 ? <>
            <h2>Demo session starts in {displayTime}</h2>
            <p>Topic: {specialty}. The voice conversation starts automatically when the countdown ends.</p>
            <button className="button outline" type="button" onClick={() => setRemaining(null)}>Cancel demo wait</button>
          </> : <>
            <h2>Starting your voice session…</h2>
            <p>Topic: {specialty}. The AERIX guide is joining now.</p>
          </>}
        </div>}
        {joined && <section className="chat-panel online-voice-panel" aria-label="Online guide conversation">
          <div className="chat-header">
            <span className="ai-mark"><Sparkles size={22}/></span>
            <div>
              <strong>AERIX demo health guide</strong>
            <p className="muted">{listening ? "Listening... your recognized words stay in this page and are answered aloud." : speaking ? "AERIX is speaking. Use Stop reply if you want to interrupt." : "Tap the microphone to speak your turn. AERIX will reply aloud; tap again when you are ready to continue."}</p>
            </div>
            {speaking && <button className="icon-button" type="button" aria-label="Stop spoken reply" onClick={() => window.speechSynthesis?.cancel()}><VolumeX size={18}/></button>}
          </div>
          <div className="chat-content" aria-live="polite">
            {messages.map((message, index) => <div key={`${index}-${message.role}`} className={`chat-message ${message.role}`}>
              <span className="message-avatar">{message.role === "assistant" ? <Sparkles size={17}/> : <Mic size={17}/>}</span>
              <div>
                <strong>{message.role === "assistant" ? "AERIX" : "You"}</strong>
                <p>{message.content}</p>
                {message.role === "assistant" && <button className="read-aloud" type="button" onClick={() => speak(message.content)}><Volume2 size={15}/> Read aloud</button>}
              </div>
            </div>)}
            <div ref={bottom}/>
          </div>
          <div className="chat-composer">
            <p className="muted">{listening ? "Listening... your recognized words stay in this page and are answered aloud." : speaking ? "AERIX is speaking. Use Stop reply if you want to interrupt." : "Tap the microphone to speak your turn. AERIX will reply aloud; tap again when you are ready to continue."}</p>
            <form onSubmit={(event) => { event.preventDefault(); void respondTo(draft); }}>
              <textarea aria-label="Your appointment conversation message" placeholder="Type a message or use the microphone…" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} rows={2}/>
              <button className="icon-button" type="button" aria-label={listening ? "Stop listening" : "Speak a turn"} onClick={startVoice}>{listening ? <MicOff size={18}/> : <Mic size={18}/>}</button>
              <button aria-label="Send message" type="submit" disabled={!draft.trim()}><Send size={18}/></button>
            </form>
            {voiceError && <small role="status">{voiceError}</small>}
            <small>General information only. For symptoms, diagnosis, or treatment, contact a qualified clinician. In an emergency, contact local emergency services.</small>
          </div>
        </section>}
      </section>
    </>
  );
}
