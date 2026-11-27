import { useEffect, useRef, useState } from "react";
import { api } from "./api";

const MAX_AUDIO_BYTES = 96 * 1024;
const MAX_DURATION_SECONDS = 60;
const REQUESTED_AUDIO_BITRATE = 10_000;

type RecordingState = "idle" | "recording" | "ready" | "transcribing" | "done" | "failed";

function formatTime(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export default function SpeechPractice({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [state, setState] = useState<RecordingState>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recording, setRecording] = useState<Blob | null>(null);
  const [recordingMimeType, setRecordingMimeType] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcription, setTranscription] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [error, setError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const bytesRecordedRef = useRef(0);
  const overflowRef = useRef(false);
  const startedAtRef = useRef(0);

  const canRecord =
    typeof MediaRecorder !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function";

  useEffect(() => {
    if (!recording) {
      setAudioUrl(null);
      return;
    }
    const url = URL.createObjectURL(recording);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [recording]);

  useEffect(() => {
    if (state !== "recording") return;
    const timer = window.setInterval(() => {
      const elapsed = Math.min(
        MAX_DURATION_SECONDS,
        Math.floor((Date.now() - startedAtRef.current) / 1000),
      );
      setElapsedSeconds(elapsed);
      if (elapsed >= MAX_DURATION_SECONDS) {
        const recorder = recorderRef.current;
        if (recorder?.state === "recording") recorder.stop();
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [state]);

  useEffect(() => () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const resetRecording = () => {
    setRecording(null);
    setRecordingMimeType("");
    setTranscription("");
    setWordCount(0);
    setElapsedSeconds(0);
    setError("");
    setState("idle");
  };

  const startRecording = async () => {
    if (!isAuthenticated) {
      setError("Sign in before using speaking practice.");
      return;
    }
    if (!canRecord) {
      setError("This browser does not support microphone recording. Open the app in a recent browser over HTTPS.");
      return;
    }

    resetRecording();
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const supportedTypes = [
        "audio/webm;codecs=opus",
        "audio/ogg;codecs=opus",
        "audio/mp4",
        "audio/webm",
        "audio/ogg",
      ];
      const mimeType = supportedTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: REQUESTED_AUDIO_BITRATE })
        : new MediaRecorder(stream, { audioBitsPerSecond: REQUESTED_AUDIO_BITRATE });
      const baseMimeType = recorder.mimeType.split(";")[0].trim().toLowerCase();
      if (!["audio/webm", "audio/ogg", "audio/mp4"].includes(baseMimeType)) {
        throw new Error("This browser selected an unsupported recording format. Use a browser that supports WebM, Ogg Opus, or MP4 audio.");
      }

      chunksRef.current = [];
      bytesRecordedRef.current = 0;
      overflowRef.current = false;
      startedAtRef.current = Date.now();
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size === 0) return;
        chunksRef.current.push(event.data);
        bytesRecordedRef.current += event.data.size;
        if (bytesRecordedRef.current > MAX_AUDIO_BYTES) {
          overflowRef.current = true;
          if (recorder.state === "recording") recorder.stop();
        }
      };

      recorder.onerror = () => {
        setError("The browser could not record this clip. Check microphone access and try again.");
        setState("failed");
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "" });
        if (overflowRef.current || blob.size > MAX_AUDIO_BYTES) {
          setRecording(null);
          setState("failed");
          setError("This recording exceeded the 96 KiB upload limit. Record a shorter clip and try again.");
          return;
        }
        if (blob.size === 0) {
          setState("failed");
          setError("No audio was captured. Check microphone access and try again.");
          return;
        }
        setRecording(blob);
        setRecordingMimeType(blob.type || recorder.mimeType);
        setElapsedSeconds(Math.max(1, Math.min(
          MAX_DURATION_SECONDS,
          Math.ceil((Date.now() - startedAtRef.current) / 1000),
        )));
        setState("ready");
      };

      recorder.start(500);
      setState("recording");
    } catch (cause) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      recorderRef.current = null;
      setState("idle");
      setError(cause instanceof Error
        ? cause.message
        : "Microphone access was unavailable. Allow microphone access and try again.");
    }
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
  };

  const transcribe = async () => {
    if (!recording || !recordingMimeType || state !== "ready") return;
    setState("transcribing");
    setError("");
    try {
      const result = await api.transcribeAudio({
        audioBase64: await blobToBase64(recording),
        mimeType: recordingMimeType,
        durationSeconds: elapsedSeconds,
      });
      setTranscription(result.transcription);
      setWordCount(result.wordCount);
      setState("done");
    } catch (cause) {
      setState("failed");
      setError(cause instanceof Error ? cause.message : "Speech transcription failed. Record a new clip to try again.");
    }
  };

  return (
    <section className="speech-practice" aria-label="Speaking practice">
      <div className="speech-heading">
        <div>
          <p className="eyebrow">SPEAKING PRACTICE</p>
          <h2>Practice speaking out loud</h2>
          <p>Record a short English response, listen to it, then get a written transcription.</p>
        </div>
        <span className="speech-limit">60 sec max · 96 KiB max</span>
      </div>

      {!isAuthenticated ? (
        <p className="speech-hint">Sign in to your Telegram account to use speaking practice.</p>
      ) : !canRecord ? (
        <p className="speech-hint">Microphone recording is not available in this browser. Use a recent browser over HTTPS.</p>
      ) : (
        <div className="speech-controls">
          {state === "idle" && (
            <button className="primary-button" onClick={() => void startRecording()}>
              Start recording
            </button>
          )}

          {state === "recording" && (
            <div className="speech-recording-row">
              <span className="recording-indicator" aria-hidden="true" />
              <strong role="status">Recording {formatTime(elapsedSeconds)} / 01:00</strong>
              <button className="secondary-button" onClick={stopRecording}>Stop recording</button>
            </div>
          )}

          {state === "ready" && recording && (
            <div className="speech-review">
              <audio controls src={audioUrl ?? undefined} aria-label="Recorded English audio" />
              <div className="speech-actions">
                <button className="primary-button" onClick={() => void transcribe()}>Transcribe audio</button>
                <button className="secondary-button" onClick={resetRecording}>Record again</button>
              </div>
              <p className="speech-hint">{formatTime(elapsedSeconds)} recorded · {Math.ceil(recording.size / 1024)} KiB</p>
            </div>
          )}

          {state === "transcribing" && (
            <p className="speech-hint" role="status">Transcribing your recording…</p>
          )}

          {state === "done" && (
            <div className="transcription-result">
              <div className="transcription-heading">
                <strong>Transcription</strong>
                <span>{wordCount} words</span>
              </div>
              <p>{transcription}</p>
              <button className="secondary-button" onClick={resetRecording}>Record another clip</button>
            </div>
          )}

          {state === "failed" && (
            <button className="secondary-button" onClick={resetRecording}>Record another clip</button>
          )}
        </div>
      )}

      {error && <p className="speech-error" role="alert">{error}</p>}
      <p className="speech-footnote">Daily allowance: up to 2 submitted recordings per user. Audio is processed for transcription and is not saved as a recording.</p>
    </section>
  );
}
