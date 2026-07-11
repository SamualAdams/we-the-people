import { saveExplanationExchange } from "./storage";

type ExplainMessage = {
  role: "assistant" | "user";
  content: string;
};

const maxSelectedTextLength = 1200;
const maxMessageLength = 1600;
const maxMessages = 12;
const maxPagePathLength = 240;
const storageTimeoutMs = 1800;

function clampText(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

function cleanMessages(value: unknown): ExplainMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(-maxMessages)
    .map((message) => ({
      role: message?.role === "assistant" ? "assistant" : "user",
      content: clampText(message?.content, maxMessageLength),
    }))
    .filter((message) => message.content.length > 0);
}

function createThreadId() {
  return crypto.randomUUID();
}

function cleanThreadId(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{8,80}$/.test(value)
    ? value
    : "";
}

function latestUserMessage(messages: ExplainMessage[], selectedText: string) {
  const latest = [...messages]
    .reverse()
    .find((message) => message.role === "user");

  return (
    latest?.content ||
    (selectedText ? `Explain: "${selectedText}"` : "Asked about this page.")
  );
}

function extractOutputText(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "output_text" in payload &&
    typeof payload.output_text === "string"
  ) {
    return payload.output_text.trim();
  }

  if (
    payload &&
    typeof payload === "object" &&
    "output" in payload &&
    Array.isArray(payload.output)
  ) {
    return payload.output
      .flatMap((item) => {
        if (
          !item ||
          typeof item !== "object" ||
          !("content" in item) ||
          !Array.isArray(item.content)
        ) {
          return [];
        }

        return item.content
          .map((content) =>
            content &&
            typeof content === "object" &&
            "text" in content &&
            typeof content.text === "string"
              ? content.text
              : "",
          )
          .filter(Boolean);
      })
      .join("\n")
      .trim();
  }

  return "";
}

function extractApiError(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object"
  ) {
    const error = payload.error as { code?: unknown; message?: unknown };
    return {
      code: typeof error.code === "string" ? error.code : "",
      message: typeof error.message === "string" ? error.message : "",
    };
  }

  return { code: "", message: "" };
}

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

async function persistWithTimeout({
  assistantMessage,
  pagePath,
  selectedText,
  threadId,
  userMessage,
}: {
  assistantMessage: string;
  pagePath: string;
  selectedText: string;
  threadId: string;
  userMessage: string;
}) {
  try {
    return await Promise.race([
      saveExplanationExchange({
        assistantMessage,
        pagePath,
        selectedText,
        threadId,
        userMessage,
      }),
      new Promise<{ persisted: boolean; threadId: string }>((resolve) => {
        setTimeout(
          () => resolve({ persisted: false, threadId }),
          storageTimeoutMs,
        );
      }),
    ]);
  } catch {
    return { persisted: false, threadId };
  }
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return json({ message: "Send selected text to explain." }, { status: 400 });
  }

  const selectedText = clampText(
    (body as { selectedText?: unknown }).selectedText,
    maxSelectedTextLength,
  );
  const messages = cleanMessages((body as { messages?: unknown }).messages);
  const threadId =
    cleanThreadId((body as { threadId?: unknown }).threadId) || createThreadId();
  const pagePath =
    clampText((body as { pagePath?: unknown }).pagePath, maxPagePathLength) ||
    "/";

  if (!selectedText && messages.length === 0) {
    return json({ message: "Highlight text first, then choose Explain." });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json(
      {
        message:
          "The explanation chat is wired up, but the site does not have an OpenAI API key configured yet. Add OPENAI_API_KEY in the hosted environment to enable model responses.",
      },
      { status: 503 },
    );
  }

  const conversation = messages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");
  const prompt = [
    "You explain Baton Rouge and East Baton Rouge Parish local-government terms in plain English.",
    "Be concise, concrete, and helpful for a resident who is trying to understand the civic map.",
    "Do not claim live authority, current office holders, or legal advice. If the highlighted text is ambiguous, say what it likely means in this civic-map context.",
    "",
    `Highlighted text: ${selectedText || "No current selection"}`,
    "",
    "Conversation:",
    conversation || "USER: Explain the highlighted text.",
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    body: JSON.stringify({
      input: prompt,
      max_output_tokens: 450,
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const payload = await response.json();
  if (!response.ok) {
    const apiError = extractApiError(payload);
    const message =
      apiError.code === "insufficient_quota"
        ? "The OpenAI API key is valid, but the account has no available quota. Add billing or use a key with quota, then try again."
        : apiError.code === "model_not_found"
          ? "The configured model is not available to this API key. Set OPENAI_MODEL to a model this project can use, such as gpt-5-mini."
          : apiError.code === "invalid_api_key"
            ? "The hosted OpenAI API key was rejected. Check OPENAI_API_KEY and try again."
            : apiError.message ||
              "The model request failed. Check the hosted OpenAI API key and model setting, then try again.";

    return json(
      {
        message,
      },
      { status: response.status },
    );
  }

  const assistantMessage =
    extractOutputText(payload) ||
    "I could not turn the model response into readable text.";
  const storage = await persistWithTimeout({
    assistantMessage,
    pagePath,
    selectedText,
    threadId,
    userMessage: latestUserMessage(messages, selectedText),
  });

  return json({
    message: assistantMessage,
    persisted: storage.persisted,
    threadId: storage.threadId,
  });
}
