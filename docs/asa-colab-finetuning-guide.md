# ASA Fine-Tuning Guide (Using Google Colab & Free GPUs)

This document provides a guide for fine-tuning the **ASA Event Assistant** model externally without overloading or crashing your local device or web server.

---

## 1. Why Fine-Tune Externally (Google Colab vs Local Device)?

- **GPU Memory Demand**: Fine-tuning an open-source LLM (such as Llama 3 8B or Mistral 7B) requires computing forward and backward passes with weight gradients and optimizer states. Even with 4-bit QLoRA, this requires **14GB to 24GB of dedicated VRAM**.
- **No Crash Risk**: Running this on your laptop or cloud server would exhaust memory, crash background services, and cause downtime.
- **Google Colab Advantage**: Google Colab provides a free/affordable cloud environment with high-end NVIDIA GPUs (T4, V100, or A100). The training executes on Google's cloud infrastructure and does not use your machine's CPU/RAM.

---

## 2. Data Collection in EventSlot

EventSlot automatically logs ASA interactions to the `AuditLog` table with:
- `action`: `"ASA_INTERACTION"`
- `userQuery`: What the organizer asked or commanded
- `reply` / `extractedDraft`: What ASA answered or structured
- `intent`: `"event_creation"`, `"organizer_events_overview"`, `"flyer_vision_analysis"`, etc.

### Exporting your Dataset:
Whenever you want to prepare a dataset for fine-tuning, run:
```bash
npx ts-node scripts/export-asa-training-data.ts
```
This generates `data/asa-finetune-dataset.jsonl` formatted for fine-tuning:
```json
{"messages": [{"role": "system", "content": "You are ASA..."}, {"role": "user", "content": "How many events do I currently have?"}, {"role": "assistant", "content": "You currently have 3 events on EventSlot: ..."}]}
```

---

## 3. Step-by-Step Google Colab Workflow

1. Open [Google Colab](https://colab.research.google.com).
2. Go to **Runtime > Change runtime type**, select **T4 GPU** (available on free tier) or **A100 GPU** (Colab Pro).
3. Install Unsloth / LoRA tools in the first Colab cell:
   ```python
   !pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
   !pip install --no-deps trl peft accelerate bitsandbytes
   ```
4. Load the base model (e.g. Llama 3 8B Instruct):
   ```python
   from unsloth import FastLanguageModel
   import torch

   max_seq_length = 2048
   model, tokenizer = FastLanguageModel.from_pretrained(
       model_name = "unsloth/llama-3-8b-Instruct-bnb-4bit",
       max_seq_length = max_seq_length,
       load_in_4bit = True,
   )

   model = FastLanguageModel.get_peft_model(
       model,
       r = 16,
       target_modules = ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
       lora_alpha = 16,
       lora_dropout = 0,
       bias = "none",
   )
   ```
5. Upload `data/asa-finetune-dataset.jsonl` using the Colab file upload panel on the left.
6. Train the model:
   ```python
   from trl import SFTTrainer
   from transformers import TrainingArguments
   from datasets import load_dataset

   dataset = load_dataset("json", data_files="asa-finetune-dataset.jsonl")

   trainer = SFTTrainer(
       model = model,
       tokenizer = tokenizer,
       train_dataset = dataset["train"],
       dataset_text_field = "text",
       max_seq_length = max_seq_length,
       args = TrainingArguments(
           per_device_train_batch_size = 2,
           gradient_accumulation_steps = 4,
           warmup_steps = 5,
           max_steps = 60,
           learning_rate = 2e-4,
           fp16 = not torch.cuda.is_bf16_supported(),
           bf16 = torch.cuda.is_bf16_supported(),
           logging_steps = 1,
           output_dir = "outputs",
       ),
   )
   trainer.train()
   ```
7. Save / Export the fine-tuned LoRA weights:
   ```python
   # Save GGUF or 16-bit LoRA adapter to Google Drive or HuggingFace
   model.save_pretrained_merged("asa-lora-model", tokenizer, save_method = "lora")
   ```
8. **Host the Model**:
   - Upload the merged weights to **Hugging Face** or **Together AI / RunPod**.
   - Set the resulting model ID in EventSlot's `.env`:
     ```env
     OPENROUTER_MODEL=your-huggingface-id/asa-event-assistant
     ```

Training completes in approximately **10 to 15 minutes** in Google Colab without consuming any local computing power.
