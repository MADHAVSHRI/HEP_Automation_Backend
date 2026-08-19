const axios = require("axios");

const CHATBOT_BASE_URL = (process.env.CHATBOT_BASE_URL || "http://localhost:5000").replace(/\/$/, "");
const CHAT_TIMEOUT_MS = Number(process.env.CHATBOT_TIMEOUT_MS || 60000);

const buildErrorPayload = (err) => {
  if (err.response) {
    return {
      status: err.response.status,
      data: err.response.data,
    };
  }

  if (err.code === "ECONNABORTED") {
    return {
      status: 504,
      data: { message: "Chatbot request timed out" },
    };
  }

  return {
    status: 503,
    data: { message: "Chatbot service unavailable" },
  };
};

exports.chat = async (req, res) => {
  try {
    const question = (req.body?.question || "").trim();
    const session_id = (req.body?.session_id || "").trim();

    if (!question) {
      return res.status(400).json({ message: "question is required" });
    }

    const payload = { question };
    if (session_id) {
      payload.session_id = session_id;
    }

    const response = await axios.post(
      `${CHATBOT_BASE_URL}/api/chat`,
      payload,
      {
        timeout: CHAT_TIMEOUT_MS,
      },
    );

    return res.status(200).json(response.data);
  } catch (err) {
    const { status, data } = buildErrorPayload(err);
    return res.status(status).json(data);
  }
};

exports.chatStream = async (req, res) => {
  try {
    const question = (req.body?.question || "").trim();
    const session_id = (req.body?.session_id || "").trim();

    if (!question) {
      return res.status(400).json({ message: "question is required" });
    }

    const payload = { question };
    if (session_id) {
      payload.session_id = session_id;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const response = await axios.post(
      `${CHATBOT_BASE_URL}/api/chat/stream`,
      payload,
      {
        responseType: "stream",
        timeout: CHAT_TIMEOUT_MS,
      }
    );

    response.data.on("data", (chunk) => {
      res.write(chunk);
      if (typeof res.flush === "function") {
        res.flush();
      }
    });

    response.data.on("end", () => {
      res.end();
    });

    response.data.on("error", (err) => {
      console.error("Chatbot stream error:", err);
      if (!res.headersSent) {
        res.status(500).json({ message: "Stream error" });
      } else {
        res.end();
      }
    });

    req.on("close", () => {
      if (response.data && response.data.destroy) {
        response.data.destroy();
      }
    });
  } catch (err) {
    if (!res.headersSent) {
      const { status, data } = buildErrorPayload(err);
      return res.status(status).json(data);
    } else {
      return res.end();
    }
  }
};

exports.health = async (req, res) => {
  try {
    const response = await axios.get(`${CHATBOT_BASE_URL}/api/health`, {
      timeout: 5000,
    });
    return res.status(200).json(response.data);
  } catch (err) {
    const { status, data } = buildErrorPayload(err);
    return res.status(status).json(data);
  }
};

