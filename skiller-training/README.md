# skiller-training

How `skillforge-skiller-0.5B` is made: the on-device model the `/skiller` page
runs in the browser. It is Qwen2.5-0.5B-Instruct, fine-tuned on the product's own
(material -> skill) pairs, then quantized to MLC's `q4f16_1` format.

The pipeline is four scripts. They run on CPU, with `torch`, `transformers`,
`peft`, `safetensors` and `numpy`; no GPU and no MLC toolchain are needed.

## 1. Dataset

`gold.jsonl`, `authored.jsonl`, `authored2.jsonl` — 12 (material -> skill) pairs.
Two are real examples taken from the app's `src/lib/samples.ts`; the rest are
written by hand to the same contract. Each pair is fed through the product's
exact prompt, so the model learns the document shape the app validates for.

## 2. Train

```
python train_lora.py --steps 160 --max-len 1664
```

LoRA (r=16) on all projections, 8.80M trainable parameters (1.75%). On this
container it is about 42 s/step, so a full run is roughly two hours. The script
is resumable: it writes the adapter and the optimizer/scheduler/RNG state every
20 steps, and `--resume` continues from there. That matters because the
container has restarted mid-run; without the state a resume would restart the
schedule from scratch.

`gradient_checkpointing_enable()` is not optional. A 1560-token step without it
exhausts memory and the container is restarted.

Output: `out/merged/` — the base weights with the adapter merged, in fp16
safetensors.

## 3. Convert to MLC q4f16_1

```
python mlc_export.py --model out/merged --out out/mlc
python assemble_model.py --shards out/mlc --out out/model
```

MLC's own `convert_weight` needs a working TVM runtime, which is not available
here. The quantization is pure arithmetic, so `mlc_export.py` reimplements it and
writes the same artefacts: `params_shard_*.bin` plus `tensor-cache.json` (what
WebLLM loads) and `ndarray-cache.json` (what MLC also writes).

The result is **byte-identical** to MLC's own output for the same input. The
quantizer was validated by exporting the base model and diffing against the
published `mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC` build: all 277,996,288 bytes
match. The details that make it match are in the script's comments; the one that
is easy to get wrong is the scale, `max_abs * float16(1/7)`, a multiplication by
the fp16 reciprocal rather than a division.

`assemble_model.py` adds `mlc-chat-config.json` and the tokenizer files, using the
published build's config verbatim (the architecture is unchanged).

## 4. Publish the weights

```
GITHUB_TOKEN=... publish_weights.sh out/model
```

WebLLM builds every artefact URL by appending `resolve/main/` to the model URL,
the Hugging Face layout. The weights are pushed to the `models` branch of this
repository under `resolve/main/`, and the app points at
`https://raw.githubusercontent.com/ciao22king/redesigned-funicular/models/resolve/main`.
GitHub's raw host serves that path with `Access-Control-Allow-Origin: *` and no
size limit; a release asset sends no CORS header and the browser would refuse it.

## The wasm is reused, not rebuilt

A compiled WebGPU library depends on the architecture and the quantization, not
on the weight values. So the model card in `src/lib/skiller-webllm.ts` reuses the
prebuilt `Qwen2-0.5B-Instruct-q4f16_1_cs1k-webgpu.wasm` and only swaps the
weights. No MLC compilation step is involved.
