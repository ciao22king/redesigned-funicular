# -*- coding: utf-8 -*-
"""Assemble a complete WebLLM model directory from the exported MLC shards.

Takes the output of mlc_export.py (params_shard_*.bin + ndarray-cache.json)
and completes it with the config and tokenizer files WebLLM loads, producing
a directory that can be dropped into a WebLLM `appConfig.model_list` entry.
"""
import argparse, json, os, shutil

REFERENCE = "/workspace/project/skillforge-skiller-0.5B"   # mlc-ai published build
TOKENIZER_SRC = "/workspace/project/qwen-base-0.5b"
TOKENIZER_FILES = ["tokenizer.json", "vocab.json", "merges.txt", "tokenizer_config.json"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--shards", required=True, help="dir with params_shard_*.bin + ndarray-cache.json")
    ap.add_argument("--out", required=True)
    ap.add_argument("--model-id", default="skillforge-skiller-0.5B")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)

    for name in os.listdir(args.shards):
        if name.endswith(".bin") or name in ("ndarray-cache.json", "tensor-cache.json"):
            shutil.copy2(os.path.join(args.shards, name), os.path.join(args.out, name))

    # The architecture is unchanged, so the chat config of the published build
    # applies verbatim. Only the weights differ.
    with open(os.path.join(REFERENCE, "mlc-chat-config.json")) as f:
        cfg = json.load(f)
    cfg["model_type"] = "qwen2"
    cfg["quantization"] = "q4f16_1"
    with open(os.path.join(args.out, "mlc-chat-config.json"), "w") as f:
        json.dump(cfg, f, indent=2)

    for tf in TOKENIZER_FILES:
        src = os.path.join(TOKENIZER_SRC, tf)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(args.out, tf))

    total = sum(os.path.getsize(os.path.join(args.out, n))
                for n in os.listdir(args.out) if n.endswith(".bin"))
    print(f"assembled {args.out}")
    print(f"  weights: {total/1e6:.1f} MB")
    print(f"  files: {sorted(os.listdir(args.out))}")


if __name__ == "__main__":
    main()
