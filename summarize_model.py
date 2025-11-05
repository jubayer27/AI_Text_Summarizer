# summarize_model.py
import sys, json, os
from transformers import PegasusForConditionalGeneration, PegasusTokenizer
from transformers import T5ForConditionalGeneration, T5Tokenizer
import torch
from docx import Document
import fitz  # PyMuPDF

def read_stdin():
    data = sys.stdin.read()
    return json.loads(data)

def extract_text_from_pdf(path):
    doc = fitz.open(path)
    text = ""
    for page in doc:
        text += page.get_text()
    return text

def extract_text_from_docx(path):
    doc = Document(path)
    return "\n".join([p.text for p in doc.paragraphs])

def summarize_text(text):
    model_name = "t5-small"  # fast & consistent on CPU
    tokenizer = T5Tokenizer.from_pretrained(model_name)
    model = T5ForConditionalGeneration.from_pretrained(model_name)

    input_text = "summarize: " + text.strip()
    tokens = tokenizer(input_text, return_tensors="pt", truncation=True, padding="longest")

    summary_ids = model.generate(
        **tokens,
        max_length=150,
        num_beams=4,
        early_stopping=True,
        repetition_penalty=2.0
    )
    return tokenizer.decode(summary_ids[0], skip_special_tokens=True)

if __name__ == "__main__":
    try:
        data = read_stdin()
        text = ""

        if "text" in data:
            text = data["text"]
        elif "file_path" in data:
            file_path = data["file_path"]
            ext = os.path.splitext(file_path)[1].lower()
            if ext == ".pdf":
                text = extract_text_from_pdf(file_path)
            elif ext == ".docx":
                text = extract_text_from_docx(file_path)
            else:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    text = f.read()

        if not text.strip():
            raise ValueError("No valid text extracted from input.")

        summary = summarize_text(text)
        print(json.dumps({"summary": summary}))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
