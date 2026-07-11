"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type ChatRole = "assistant" | "user";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

type SelectionState = {
  text: string;
  x: number;
  y: number;
};

const maxSelectionLength = 1200;

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function compactSelection(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, maxSelectionLength);
}

function isAssistantSurface(node: Node | null) {
  return node instanceof Element
    ? Boolean(node.closest("[data-selection-assistant]"))
    : false;
}

function getSelectionState(): SelectionState | null {
  const selected = window.getSelection();
  if (!selected || selected.rangeCount === 0 || selected.isCollapsed) {
    return null;
  }

  if (
    isAssistantSurface(selected.anchorNode) ||
    isAssistantSurface(selected.focusNode)
  ) {
    return null;
  }

  const text = compactSelection(selected.toString());
  if (!text) {
    return null;
  }

  const range = selected.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  if (!rect.width && !rect.height) {
    return null;
  }

  return {
    text,
    x: Math.min(
      window.innerWidth - 132,
      Math.max(132, rect.left + rect.width / 2),
    ),
    y: Math.max(12, rect.top - 58),
  };
}

export function SelectionExplainChat() {
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [contextText, setContextText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy");
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const contextPreview = useMemo(() => {
    if (!contextText) {
      return "";
    }

    return contextText.length > 150
      ? `${contextText.slice(0, 150).trim()}...`
      : contextText;
  }, [contextText]);

  useEffect(() => {
    function updateSelection() {
      window.setTimeout(() => {
        setSelection(getSelectionState());
        setCopyLabel("Copy");
      }, 0);
    }

    document.addEventListener("mouseup", updateSelection);
    document.addEventListener("keyup", updateSelection);
    document.addEventListener("touchend", updateSelection);

    return () => {
      document.removeEventListener("mouseup", updateSelection);
      document.removeEventListener("keyup", updateSelection);
      document.removeEventListener("touchend", updateSelection);
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, isPending]);

  async function copySelection() {
    if (!selection?.text) {
      return;
    }

    await navigator.clipboard.writeText(selection.text);
    setCopyLabel("Copied");
  }

  async function askModel(nextMessages: ChatMessage[], selectedText: string) {
    setIsPending(true);

    try {
      const response = await fetch("/api/explain", {
        body: JSON.stringify({
          selectedText,
          messages: nextMessages.map(({ role, content }) => ({
            role,
            content,
          })),
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const payload = (await response.json()) as { message?: string };
      const content =
        payload.message ??
        "I could not get an explanation back. Try again in a moment.";

      setMessages((current) => [
        ...current,
        { id: createId(), role: "assistant", content },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: "assistant",
          content:
            "The explanation service is not reachable right now. Try again in a moment.",
        },
      ]);
    } finally {
      setIsPending(false);
    }
  }

  async function explainSelection() {
    if (!selection?.text || isPending) {
      return;
    }

    const selectedText = selection.text;
    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: `Explain: "${selectedText}"`,
    };
    const nextMessages = [...messages, userMessage];

    setContextText(selectedText);
    setMessages(nextMessages);
    setIsOpen(true);
    setSelection(null);
    window.getSelection()?.removeAllRanges();

    await askModel(nextMessages, selectedText);
  }

  async function submitFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const question = input.trim();
    if (!question || isPending) {
      return;
    }

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: question,
    };
    const nextMessages = [...messages, userMessage];

    setInput("");
    setMessages(nextMessages);
    setIsOpen(true);

    await askModel(nextMessages, contextText);
  }

  return (
    <div data-selection-assistant>
      {selection ? (
        <div
          className="selection-toolbar"
          style={{
            left: selection.x,
            top: selection.y,
          }}
        >
          <button onClick={copySelection} type="button">
            {copyLabel}
          </button>
          <button aria-disabled="true" disabled type="button">
            Chat
          </button>
          <button onClick={explainSelection} type="button">
            Explain
          </button>
        </div>
      ) : null}

      {isOpen ? (
        <aside
          aria-label="Explain selected text"
          className="explain-chat"
          role="dialog"
        >
          <div className="explain-chat-header">
            <div>
              <p className="eyebrow">Explain</p>
              <h2>Ask about this page</h2>
            </div>
            <button
              aria-label="Close explanation chat"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              Close
            </button>
          </div>

          {contextPreview ? (
            <blockquote className="context-chip">{contextPreview}</blockquote>
          ) : null}

          <div className="message-list" aria-live="polite">
            {messages.map((message) => (
              <article
                className={`message-bubble message-${message.role}`}
                key={message.id}
              >
                <p>{message.content}</p>
              </article>
            ))}
            {isPending ? (
              <article className="message-bubble message-assistant">
                <p>Thinking...</p>
              </article>
            ) : null}
            <div ref={chatEndRef} />
          </div>

          <form className="chat-form" onSubmit={submitFollowUp}>
            <label className="sr-only" htmlFor="explain-follow-up">
              Ask a follow-up question
            </label>
            <textarea
              id="explain-follow-up"
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask a follow-up..."
              rows={2}
              value={input}
            />
            <button disabled={isPending || !input.trim()} type="submit">
              Send
            </button>
          </form>
        </aside>
      ) : null}
    </div>
  );
}
