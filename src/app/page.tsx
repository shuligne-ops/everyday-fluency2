'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, type Lesson } from '@/lib/supabase';
import ReactMarkdown from 'react-markdown';
import { normalizeMarkdown } from '@/lib/normalizeMarkdown';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export default function Home() {
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);

  // Load lessons when level changes
  useEffect(() => {
    if (!selectedLevel) return;
    const loadLessons = async () => {
      const { data } = await supabase
        .from('lessons')
        .select('id, level, lesson_number, title_fr, title_ru')
        .eq('level', selectedLevel)
        .order('lesson_number');
      if (data) setLessons(data as Lesson[]);
    };
    loadLessons();
  }, [selectedLevel]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [input]);

  // Start a lesson
  const startLesson = async (lesson: Lesson) => {
    // Fetch full lesson data
    const { data } = await supabase
      .from('lessons')
      .select('*')
      .eq('id', lesson.id)
      .single();

    if (!data) return;
    setSelectedLesson(data as Lesson);

    const firstMessage = {
      role: 'user',
      content: `Commence la leçon ${data.level}-${String(data.lesson_number).padStart(2, '0')}: "${data.title_fr}". Niveau: ${data.level}.`,
    };
    setMessages([firstMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [firstMessage],
          lessonData: data.content,
        }),
      });

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let assistantMessage = '';
      let buffer = '';

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.text) {
                assistantMessage += parsed.text;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: assistantMessage };
                  return updated;
                });
              }
            } catch {}
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Send message
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          lessonData: selectedLesson?.content,
        }),
      });

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let assistantMessage = '';
      let buffer = '';

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.text) {
                assistantMessage += parsed.text;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: assistantMessage };
                  return updated;
                });
              }
            } catch {}
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // TTS - play audio
  const playAudio = async (text: string) => {
    if (isPlaying) return;
    setIsPlaying(true);

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => setIsPlaying(false);
      await audio.play();
    } catch {
      setIsPlaying(false);
    }
  };

  // Speech recognition
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Распознавание речи не поддерживается в этом браузере');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      // Reset silence timer on each result (2 extra seconds)
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        recognition.stop();
        setIsRecording(false);
      }, 4000); // 4 seconds of silence before auto-stop

      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
    };

    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, [isRecording]);

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // RENDER: Level Selection
  if (!selectedLevel) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <h1 className="text-4xl font-display font-bold text-france-dark mb-2">
          Français au Quotidien
        </h1>
        <p className="text-lg text-gray-600 mb-10">Разговорный французский каждый день</p>

        <div className="grid grid-cols-3 gap-4 max-w-md w-full">
          {LEVELS.map((level) => (
            <button
              key={level}
              onClick={() => setSelectedLevel(level)}
              className="level-btn bg-white border-2 border-france-blue text-france-blue font-bold text-xl py-6 rounded-xl hover:bg-france-blue hover:text-white transition-all"
            >
              {level}
            </button>
          ))}
        </div>

        <p className="text-sm text-gray-400 mt-8">180 уроков • A1–C2 • Живые диалоги</p>
      </div>
    );
  }

  // RENDER: Lesson List
  if (!selectedLesson) {
    return (
      <div className="min-h-screen p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => { setSelectedLevel(null); setLessons([]); }}
            className="text-france-blue text-2xl"
          >
            ←
          </button>
          <h2 className="text-2xl font-display font-bold">
            Niveau {selectedLevel}
          </h2>
        </div>

        <div className="space-y-2">
          {lessons.map((lesson) => (
            <button
              key={lesson.id}
              onClick={() => startLesson(lesson)}
              className="w-full text-left p-4 bg-white rounded-lg border border-gray-200 hover:border-france-blue hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-3">
                <span className="text-france-blue font-bold text-sm w-8">
                  {String(lesson.lesson_number).padStart(2, '0')}
                </span>
                <div>
                  <div className="font-medium text-france-dark">{lesson.title_fr}</div>
                  <div className="text-sm text-gray-500">{lesson.title_ru}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // RENDER: Chat View
  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-white">
        <button
          onClick={() => { setSelectedLesson(null); setMessages([]); }}
          className="text-france-blue text-xl"
        >
          ←
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-france-dark truncate">
            {selectedLesson.title_fr}
          </div>
          <div className="text-xs text-gray-500">
            {selectedLesson.level}-{String(selectedLesson.lesson_number).padStart(2, '0')} • {selectedLesson.title_ru}
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 chat-scroll">
        {messages.filter(m => m.role !== 'user' || !m.content.startsWith('Commence la leçon')).map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={msg.role === 'user' ? 'bubble-user' : 'bubble-assistant'}>
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{normalizeMarkdown(msg.content)}</ReactMarkdown>
                </div>
              ) : (
                <p>{msg.content}</p>
              )}
              {msg.role === 'assistant' && msg.content && (
                <button
                  onClick={() => playAudio(msg.content)}
                  disabled={isPlaying}
                  className="mt-2 text-xs text-gray-400 hover:text-france-blue transition-colors"
                >
                  {isPlaying ? '🔊 ...' : '🔈 Écouter'}
                </button>
              )}
            </div>
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.content === '' && (
          <div className="flex justify-start">
            <div className="bubble-assistant">
              <span className="animate-pulse">Camille réfléchit...</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t bg-white p-3">
        <div className="flex items-end gap-2 max-w-2xl mx-auto">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Écrivez en français..."
            className="chat-input flex-1 border border-gray-300 rounded-2xl px-4 py-3 focus:outline-none focus:border-france-blue text-sm"
            rows={1}
          />
          <button
            onClick={toggleRecording}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
              isRecording
                ? 'bg-france-red text-white animate-pulse'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            🎤
          </button>
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="w-11 h-11 rounded-full bg-france-blue text-white flex items-center justify-center hover:bg-blue-800 disabled:opacity-50 transition-all"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
