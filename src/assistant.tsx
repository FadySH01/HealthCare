import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowUp,
  ArrowUpRight,
  HeartPulse,
  MessageCircle,
  Sparkles,
  ShieldCheck,
  Trash2,
  UserRound,
  Volume2,
  Mic,
} from "lucide-react";
import { useApp } from "./context";
import { offlineGuideReply } from "./offline-guide";
import { Notice, PageTitle } from "./components";
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
export function Assistant() {
  const { user } = useApp();
  const location = useLocation();
  const [messages, setMessages] = useState<
      { role: "user" | "assistant"; content: string }[]
    >([]),
    [draft, setDraft] = useState(""),
    [listening, setListening] = useState(false),
    [voiceError, setVoiceError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  useEffect(() => () => { window.speechSynthesis?.cancel(); recognition.current?.stop(); }, []);
  useEffect(() => {
    const routeState = location.state as { guidedQuestion?: string; voiceSession?: boolean; specialty?: string } | null;
    if (routeState?.voiceSession) {
      setDraft("");
      setMessages([{ role: "assistant", content: `Hello, I’m the AERIX demo health guide for ${routeState.specialty || "general care"}. I’m an AI guide, not a doctor. Tell me what you would like help with, and I can share general information and help you find appropriate care. I can’t diagnose you or prescribe medicine.` }]);
    } else if (routeState?.guidedQuestion) setDraft(routeState.guidedQuestion);
  }, [location.state]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    const question = draft.trim();
    const next = [
      ...messages,
      { role: "user" as const, content: question },
    ];
    setMessages(next);
    setDraft("");
    setMessages([...next, { role: "assistant", content: offlineGuideReply(question) }]);
  }
  function toggleVoice() {
    if (listening) { recognition.current?.stop(); return; }
    const speechWindow = window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) { setVoiceError("Voice input is not supported in this browser. You can type your question instead."); return; }
    setVoiceError("");
    const instance = new SpeechRecognition();
    instance.lang = "en-NG";
    instance.interimResults = false;
    instance.maxAlternatives = 1;
    instance.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) setDraft((current) => `${current}${current ? " " : ""}${transcript}`.slice(0, 2000));
    };
    instance.onerror = (event) => {
      const messages: Record<string, string> = {
        "not-allowed": "Microphone access is blocked. In Chrome, open the site controls beside the address, open Site settings, set Microphone to Allow for localhost, then refresh. Also allow microphone access in Windows Settings > Privacy & security > Microphone.",
        "service-not-allowed": "Chrome's speech service is blocked by a browser or device policy. You can type your question instead.",
        "audio-capture": "No microphone was detected. Connect or enable your microphone in Windows sound settings, then try again.",
        network: "The browser speech service could not connect. Check your internet connection and try again, or type your question.",
        "no-speech": "No speech was detected. Check that the microphone is not muted, then try again.",
      };
      setVoiceError(messages[event.error || ""] || "Voice input could not start. Check microphone access in Chrome and Windows, or type your question.");
      setListening(false);
    };
    instance.onend = () => setListening(false);
    recognition.current = instance;
    setListening(true);
    try { instance.start(); } catch { setListening(false); setVoiceError("The microphone could not start. Check browser permission."); }
  }
  const starters = [
    "How can I prepare for a doctor’s visit?",
    "What should I ask a pharmacist about a medicine?",
    "What are some healthy daily habits?",
  ];
  return (
    <>
      <PageTitle
        eyebrow={(location.state as { voiceSession?: boolean } | null)?.voiceSession ? "ONLINE GUIDE SESSION · DEMO" : "A LITTLE CLARITY GOES A LONG WAY"}
        title={(location.state as { voiceSession?: boolean } | null)?.voiceSession ? "Your AERIX guide is ready to listen." : "Let’s talk about your health."}
        description={(location.state as { voiceSession?: boolean } | null)?.voiceSession ? "Tap the microphone, say what you need help with, review the words it heard, then tap send for a general-information reply." : "Ask common health questions by typing or voice. Replies use AERIX’s free local dataset; no paid AI API is used."}
      />
      <div className="assistant-layout">
        <section className="chat-panel">
          <div className="chat-header">
            <span className="ai-mark">
              <Sparkles size={22} />
            </span>
            <div>
              <strong>AERIX health guide</strong>
              <span>
                <i className="connection-dot connected" />
                Free offline guide · reviewed health topics · no paid AI API
              </span>
            </div>
            <button
              className="icon-button"
              aria-label="Clear conversation"
              disabled={!messages.length}
              onClick={() => {
                setMessages([]);
              }}
            >
              <Trash2 size={18} />
            </button>
          </div>
          <div className="chat-content" aria-live="polite">
            {!messages.length ? (
              <div className="chat-welcome">
                <div className="assistant-orb">
                  <Sparkles size={36} />
                </div>
                <span className="eyebrow">
                  HELLO,{" "}
                  {user ? user.name.split(" ")[0].toUpperCase() : "THERE"}.
                </span>
                <h2>Simple answers for common health questions.</h2>
                <p>
                  Choose a topic or type a question. AERIX looks up a reviewed topic on this device.
                </p>
                <div className="starter-prompts">
                  {starters.map((s) => (
                    <button key={s} onClick={() => setDraft(s)}>
                      <MessageCircle size={17} />
                      {s}
                      <ArrowUpRight size={15} />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`chat-message ${m.role}`}>
                  <span className="message-avatar">
                    {m.role === "assistant" ? (
                      <Sparkles size={17} />
                    ) : (
                      <UserRound size={17} />
                    )}
                  </span>
                  <div>
                    <strong>{m.role === "assistant" ? "AERIX" : "You"}</strong>
                  <p>{m.content}</p>
                  {m.role === "assistant" && "speechSynthesis" in window && <button className="read-aloud" type="button" onClick={() => { window.speechSynthesis.cancel(); const speech = new SpeechSynthesisUtterance(m.content); speech.lang = "en-NG"; window.speechSynthesis.speak(speech); }}><Volume2 size={15}/> Read aloud</button>}
                  </div>
                </div>
              ))
            )}
            <div ref={bottom} />
          </div>
          <div className="chat-composer">
                <div className="ai-setup-note">
                  {(location.state as { voiceSession?: boolean } | null)?.voiceSession ? "Demo voice session: answers use AERIX local health dataset. No OpenAI API call is made." : "Free offline guide: typed questions match this local dataset and are not sent to AI."}
                  <Link to="/care"> Find care and contact a facility <ArrowUpRight size={14} /></Link>
                </div>
                <p className="muted">This health guide is not a clinician or emergency service. It cannot diagnose or prescribe.</p>
                <form onSubmit={send}>
                  <textarea
                    aria-label="Your health question"
                    placeholder="What’s on your mind?"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={2000}
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (draft.trim())
                          send(e);
                      }
                    }}
                  />
                  <button className="icon-button" type="button" aria-label={listening ? "Stop voice input" : "Speak your question"} onClick={toggleVoice}><Mic size={18}/></button>
                  <button
                    aria-label="Send message"
                    type="submit"
                    disabled={!draft.trim()}
                  >
                    <ArrowUp size={20} />
                  </button>
                </form>
                {listening && <small role="status">Listening... check the transcript before sending. Your browser speech service may process the audio.</small>}
                {voiceError && <small role="status">{voiceError}</small>}
            <small>
              General information only. Check personal health decisions with a qualified professional.
            </small>
          </div>
        </section>
        <aside className="chat-sidebar">
          <section className="panel">
            <span className="feature-icon violet">
              <ShieldCheck size={22} />
            </span>
            <h3>
              Made for information.
              <br />
              Not diagnosis.
            </h3>
            <p>
              AERIX can explain general health topics and help you prepare
              questions. It cannot prescribe medicines, diagnose symptoms, or
              replace a clinician.
            </p>
            <Link className="text-link" to="/privacy">
              How your privacy works <ArrowUpRight size={15} />
            </Link>
          </section>
          <section className="urgent-card">
            <HeartPulse size={22} />
            <h3>Need urgent help?</h3>
            <p>
              For severe symptoms or immediate danger, contact local emergency
              services or go to the nearest emergency department. Don’t wait for
              a reply from this guide.
            </p>
            <strong>This chat is not monitored by clinicians.</strong>
          </section>
          <Notice>
            Messages stay in this page’s memory and disappear when you leave or clear the chat. The guide does not send questions to a server.
          </Notice>
        </aside>
      </div>
    </>
  );
}
