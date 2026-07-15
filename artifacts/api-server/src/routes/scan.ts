import { Router } from "express";
import multer from "multer";
import Groq from "groq-sdk";
import { requireActiveAuth } from "../lib/auth.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const PROMPTS: Record<string, string> = {
  "machine": `You are reading an equipment nameplate or label on a machine.
Extract as much as you can and return a JSON object with these keys (omit keys you cannot find):
- machineName (string): full name/type of the machine or equipment
- machineNumber (string): ID, asset tag, or reference number on the label
- location (string): room, area, or building if visible

Return ONLY valid JSON. No markdown, no explanation.`,

  "spare-part": `You are reading a spare part label, box, or packaging.
Extract as much as you can and return a JSON object with these keys (omit keys you cannot find):
- partName (string): name or description of the part
- partCode (string): part number, SKU, or product code
- category (string): type or category (e.g. Electrical, Mechanical, Filter)
- unit (string): unit of measure (e.g. piece, meter, kg)
- description (string): any additional technical specs or details visible

Return ONLY valid JSON. No markdown, no explanation.`,

  "maintenance-request": `You are reading a handwritten or printed maintenance failure report or notice.
Extract as much as you can and return a JSON object with these keys (omit keys you cannot find):
- failureDescription (string): description of the failure, problem, or fault observed
- departmentSection (string): department or section name if mentioned
- reportingPersonName (string): name of the person who reported the issue

Return ONLY valid JSON. No markdown, no explanation.`,
};

// POST /api/scan?formType=machine|spare-part|maintenance-request
router.post("/", requireActiveAuth, upload.single("image"), async (req, res, next) => {
  try {
    if (!process.env.GROQ_API_KEY) {
      res.status(503).json({ error: "AI service not configured. Set GROQ_API_KEY in your environment." });
      return;
    }

    const formType = String(req.query.formType ?? "machine");
    const prompt = PROMPTS[formType] ?? PROMPTS["machine"];

    if (!req.file) {
      res.status(400).json({ error: "No image file provided." });
      return;
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const response = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}` },
            },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    let extracted: Record<string, unknown> = {};
    try {
      extracted = JSON.parse(raw);
    } catch {
      const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) extracted = JSON.parse(match[1]);
    }

    res.json(extracted);
  } catch (err) { next(err); }
});

export default router;
