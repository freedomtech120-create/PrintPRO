import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // SMS API Endpoint
  app.post("/api/send-sms", async (req, res) => {
    const { provider, apiKey, senderId, recipients, message } = req.body;

    if (!provider || !apiKey || !senderId || !recipients || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      if (provider === 'arkasel') {
        // Arkasel API Logic
        const response = await axios.post("https://sms.arkasel.com/sms/api", null, {
          params: {
            action: 'send-sms',
            api_key: apiKey,
            to: recipients.join(','),
            from: senderId,
            sms: message
          }
        });
        return res.json({ success: true, data: response.data });
      } else if (provider === 'mnotify') {
        // mNotify API Logic
        const response = await axios.post(`https://api.mnotify.com/api/sms/quick?key=${apiKey}`, {
          recipient: recipients,
          sender: senderId,
          message: message,
          is_schedule: false
        });
        return res.json({ success: true, data: response.data });
      }

      res.status(400).json({ error: "Invalid provider" });
    } catch (error: any) {
      console.error("SMS Error:", error.response?.data || error.message);
      res.status(500).json({ error: "Failed to send SMS", details: error.response?.data || error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
