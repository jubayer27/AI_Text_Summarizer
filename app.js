// app.js
import express from "express";
import path from "path";
import { spawn } from "child_process";
import multer from "multer";
import cors from "cors";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.resolve();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // serve index.html

// Set up Multer for file uploads
const upload = multer({ dest: "uploads/" });

// ---------- ROUTES ----------

// Serve index.html
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// Summarize plain text
app.post("/summarize", (req, res) => {
    const { text } = req.body;
    if (!text || text.trim().length === 0) {
        return res.status(400).json({ error: "No text provided." });
    }

    const python = spawn("python3", [path.join(__dirname, "summarize_model.py")]);
    let output = "";

    python.stdin.write(JSON.stringify({ text }));
    python.stdin.end();

    python.stdout.on("data", (data) => {
        output += data.toString();
    });

    python.stderr.on("data", (data) => {
        console.error("Python error:", data.toString());
    });

    python.on("close", () => {
        try {
            const result = JSON.parse(output);
            if (result.error) return res.status(500).json({ error: result.error });
            res.json({ summary: result.summary });
        } catch (err) {
            console.error("JSON parse failed:", output);
            res.status(500).json({ error: "Failed to parse summarizer output." });
        }
    });
});

// Summarize uploaded file
app.post("/summarize-file", upload.single("file"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded." });
    }

    const filePath = path.join(__dirname, req.file.path);
    const python = spawn("python3", [path.join(__dirname, "summarize_model.py")]);
    let output = "";

    python.stdin.write(JSON.stringify({ file_path: filePath }));
    python.stdin.end();

    python.stdout.on("data", (data) => {
        output += data.toString();
    });

    python.stderr.on("data", (data) => {
        console.error("Python error:", data.toString());
    });

    python.on("close", () => {
        fs.unlinkSync(filePath); // cleanup temp file
        try {
            const result = JSON.parse(output);
            if (result.error) return res.status(500).json({ error: result.error });
            res.json({ summary: result.summary });
        } catch (err) {
            console.error("JSON parse failed:", output);
            res.status(500).json({ error: "Failed to parse summarizer output." });
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});
