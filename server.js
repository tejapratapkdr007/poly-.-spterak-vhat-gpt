// ============================
// 📁 FILE 1: server.js (FINAL FIXED)
// ============================

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cron = require("node-cron");
const { MongoClient } = require("mongodb");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;
const MONGO_URI = process.env.MONGO_URI;

let db;

async function connectDB() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db("polyspark");
  console.log("MongoDB Connected");
}

// ============================
// ✅ SCORES + LEADERBOARD
// ============================
app.post("/scores", async (req, res) => {
  const { pin, name, points } = req.body;

  await db.collection("users").updateOne(
    { pin },
    {
      $set: { name },
      $inc: { points: points }
    },
    { upsert: true }
  );

  res.json({ success: true });
});

app.get("/leaderboard", async (req, res) => {
  const users = await db
    .collection("users")
    .find()
    .sort({ points: -1 })
    .limit(50)
    .toArray();

  res.json(users);
});

// ============================
// ✅ AI SPEAKING ANALYSIS
// ============================
app.post("/speaking/analyze", async (req, res) => {
  const { transcript } = req.body;

  if (!transcript) {
    return res.status(400).json({ error: "No transcript" });
  }

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "user",
            content: `Check grammar and return JSON:\n{ score, corrected, errors, feedback }\nText: ${transcript}`
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );

    const output = JSON.parse(response.data.choices[0].message.content);
    res.json(output);
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: "AI failed" });
  }
});

// ============================
// ✅ QUESTIONS (SIMPLE)
// ============================
app.post("/questions", async (req, res) => {
  const { question, answer } = req.body;

  await db.collection("questions").insertOne({
    question,
    answer,
    createdAt: new Date()
  });

  res.json({ success: true });
});

app.get("/questions", async (req, res) => {
  const data = await db.collection("questions").find().toArray();
  res.json(data);
});

// ============================
// ✅ AUTOMATION (5AM)
// ============================
cron.schedule("0 5 * * *", async () => {
  console.log("Running Auto Post");

  const schedule = await db.collection("schedule").findOne({});
  if (!schedule) return;

  for (let q of schedule.questions) {
    if (!q.posted) {
      await db.collection("questions").insertOne(q);
      q.posted = true;
    }
  }

  await db.collection("schedule").updateOne({}, { $set: schedule });
});

// ============================
// START SERVER
// ============================
connectDB().then(() => {
  app.listen(PORT, () => console.log("Server running on port " + PORT));
});


// ============================
// 📁 FILE 2: index.html (IMPORTANT FIXED PARTS ONLY)
// ============================

/* ADD THIS INSIDE <script> TAG */

// 🎤 SPEECH RECOGNITION FIX
let recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.continuous = false;
recognition.interimResults = false;

recognition.onresult = (event) => {
  const text = event.results[0][0].transcript;
  sendToAI(text);
  recognition.stop();
};

function startSpeech() {
  recognition.start();
}

// 🤖 SEND TO AI
async function sendToAI(text) {
  const res = await fetch("/speaking/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript: text })
  });

  const data = await res.json();

  document.getElementById("userText").innerText = text;
  document.getElementById("aiText").innerText = data.corrected;

  window.userText = text;
  window.aiText = data.corrected;
}

// 🔊 AUDIO PLAYBACK
function play(text) {
  stop();
  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = "en-US";
  speechSynthesis.speak(msg);
}

function stop() {
  speechSynthesis.cancel();
}


/* ADD THIS UI WHERE YOU WANT (TOP PRIORITY) */

/*
<div>
  <h2>🎤 Speaking AI</h2>

  <button onclick="startSpeech()">Start Speaking</button>

  <p><b>You Said:</b> <span id="userText"></span></p>
  <p><b>AI Corrected:</b> <span id="aiText"></span></p>

  <button onclick="play(userText)">▶ Play My Voice</button>
  <button onclick="play(aiText)">▶ Play AI Voice</button>
  <button onclick="stop()">⏹ Stop</button>
</div>
*/

// ============================
// ✅ DONE
// ============================
