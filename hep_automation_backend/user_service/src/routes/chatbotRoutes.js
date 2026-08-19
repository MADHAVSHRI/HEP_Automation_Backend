const express = require("express");
const router = express.Router();
const chatbotController = require("../controllers/chatbotController");

router.post("/chat", chatbotController.chat);
router.post("/chat/stream", chatbotController.chatStream);
router.get("/health", chatbotController.health);

module.exports = router;
