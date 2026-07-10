const axios = require("axios");

const CHATBOT_BASE_URL = (process.env.CHATBOT_BASE_URL || "http://localhost:5000").replace(/\/$/, "");
const CHAT_TIMEOUT_MS = Number(process.env.CHATBOT_TIMEOUT_MS || 20000);

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

    if (!question) {
      return res.status(400).json({ message: "question is required" });
    }

    const response = await axios.post(
      `${CHATBOT_BASE_URL}/api/chat`,
      { question },
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
