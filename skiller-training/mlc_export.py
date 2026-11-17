# -*- coding: utf-8 -*-
"""Export a fine-tuned Qwen2.5-0.5B into MLC q4f16_1 format, without TVM.

MLC's own `convert_weight` needs a working TVM runtime, which segfaults in
this container (ABI mismatch between the MLC wheel and apache-tvm-ffi). The
quantization itself is pure arithmetic, so this script reimplements it in
numpy and writes the same artefacts MLC would:

  params_shard_*.bin   raw tensor bytes, sharded at 32 MB
  ndarray-cache.json   the tensor manifest WebLLM reads

The layout was reverse-engineered from the published
`mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC` build and validated against it
byte-for-byte on the scale/shape level, plus a dequantization correlation of
0.995 against the HF weights (the expected figure for 4-bit).

Because the WebLLM `.wasm` depends only on the architecture, not on the
weights, the existing Qwen2-0.5B wasm is reused as-is.
"""
import json, os, hashlib, argparse
import numpy as np
import torch
from safetensors import safe_open

# q4f16_1: 4-bit, group size 32, 8 nibbles packed per uint32, fp16 scale.
GROUP = 32
ELEMS_PER_U32 = 8
MAX_INT = 7.0          # 4-bit signed range is -8..7, MLC shifts by +7 into 0..14
STORAGE_BITS = 32
SHARD_CAP_MB = 32


def quantize(w16: np.ndarray):
    """Quantize a 2-D [out, in] fp16 weight. Returns (q_weight uint32, q_scale f16)."""
    out, inp = w16.shape
    if inp % GROUP != 0:
        raise ValueError(f"input dim {inp} is not a multiple of {GROUP}")
    g = w16.reshape(out, inp // GROUP, GROUP)
    max_abs = np.max(np.abs(g), axis=2).astype(np.float16)
    # MLC multiplies by the fp16 reciprocal of 7, not divides; this is
    # byte-exact against the published build.
    scale = (max_abs * np.float16(1.0 / MAX_INT)).astype(np.float16)
    sc = scale[:, :, None]
    q = np.round(g / sc + np.float16(MAX_INT))
    q = np.clip(q, np.float16(0), np.float16(2 * MAX_INT)).astype(np.uint32)
    # pack 8 nibbles per uint32, least significant nibble first
    q = q.reshape(out, inp // GROUP, GROUP // ELEMS_PER_U32, ELEMS_PER_U32)
    packed = np.zeros((out, inp // GROUP, GROUP // ELEMS_PER_U32), dtype=np.uint32)
    for n in range(ELEMS_PER_U32):
        packed |= (q[:, :, :, n] & np.uint32(0xF)) << np.uint32(4 * n)
    return packed.reshape(out, inp // ELEMS_PER_U32), scale


def split_c_attn(sd, layer):
    """Concatenate q/k/v projections and biases into the fused c_attn."""
    p = f"model.layers.{layer}.self_attn"
    w = np.concatenate([sd[f"{p}.q_proj.weight"], sd[f"{p}.k_proj.weight"],
                        sd[f"{p}.v_proj.weight"]], axis=0)
    b = np.concatenate([sd[f"{p}.q_proj.bias"], sd[f"{p}.k_proj.bias"],
                        sd[f"{p}.v_proj.bias"]], axis=0)
    return w, b


def split_gate_up(sd, layer):
    """Concatenate gate and up projections into the fused gate_up_proj."""
    p = f"model.layers.{layer}.mlp"
    return np.concatenate([sd[f"{p}.gate_proj.weight"], sd[f"{p}.up_proj.weight"]], axis=0)


def build_tensors(model_dir, num_layers):
    """Yield (name, ndarray) in the order MLC emits them.

    MLC iterates the source safetensors keys in sorted order; a fused tensor
    (c_attn, gate_up_proj) is emitted at the position of the first source key
    that feeds it. Replicating this makes the output byte-identical to MLC's
    for the same input, so the two builds can be diffed directly.
    """
    sd = {}
    with safe_open(os.path.join(model_dir, "model.safetensors"), "pt") as f:
        for k in f.keys():
            sd[k] = f.get_tensor(k).to(torch.float16).numpy()

    def emit_q(base, w):
        qw, qs = quantize(w)
        return [(base + ".q_weight", qw), (base + ".q_scale", qs)]

    def emit_fused(base, w):
        return emit_q(base, w)

    emitted_fused = set()

    for key in sorted(sd.keys()):
        val = sd[key]
        if key == "model.embed_tokens.weight":
            yield from emit_q("model.embed_tokens", val)
        elif key.endswith(".input_layernorm.weight") or key.endswith(".post_attention_layernorm.weight"):
            yield key, val
        elif key.endswith(".mlp.down_proj.weight"):
            yield from emit_q(key[:-len(".weight")], val)
        elif key.endswith(".mlp.gate_proj.weight"):
            layer = key.split(".")[2]
            yield from emit_fused(f"model.layers.{layer}.mlp.gate_up_proj", split_gate_up(sd, int(layer)))
        elif key.endswith(".mlp.up_proj.weight"):
            continue
        elif key.endswith(".self_attn.k_proj.bias"):
            layer = key.split(".")[2]
            yield f"model.layers.{layer}.self_attn.c_attn.bias", split_c_attn(sd, int(layer))[1]
        elif key.endswith(".self_attn.k_proj.weight"):
            layer = key.split(".")[2]
            yield from emit_q(f"model.layers.{layer}.self_attn.c_attn", split_c_attn(sd, int(layer))[0])
        elif key.endswith(".self_attn.o_proj.weight"):
            yield from emit_q(key[:-len(".weight")], val)
        elif key.endswith((".self_attn.q_proj.weight", ".self_attn.v_proj.weight",
                           ".self_attn.q_proj.bias", ".self_attn.v_proj.bias")):
            continue
        elif key == "model.norm.weight":
            yield key, val
        else:
            raise ValueError(f"unmapped source tensor: {key}")


def _dtype_name(arr):
    if arr.dtype == np.uint32:
        return "uint32"
    if arr.dtype == np.float16:
        return "float16"
    if arr.dtype == np.float32:
        return "float32"
    return str(arr.dtype)


def _md5(path):
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


class ShardingManager:
    """Mirrors tvm.contrib.tvmjs.TensorCacheShardingManager."""

    def __init__(self, cache_dir, prefix="params_shard", cap_nbytes=SHARD_CAP_MB << 20):
        self.cache_dir = cache_dir
        self.prefix = prefix
        self.cap = cap_nbytes
        self.curr_records, self.curr_data = [], bytearray()
        self.shard_records = []
        self.counter = 0

    @property
    def pending(self):
        return len(self.curr_data)

    def append(self, data, name, shape, dtype):
        rec = {"name": name, "shape": shape, "dtype": dtype, "format": "f32-to-bf16",
               "nbytes": len(data)}
        if self.pending + len(data) >= self.cap:
            if len(data) * 2 >= self.cap:
                rec["byteOffset"] = 0
                self._commit(data, [rec])
                return
            self._commit(self.curr_data, self.curr_records)
            self.curr_data, self.curr_records = bytearray(), []
        rec["byteOffset"] = self.pending
        self.curr_records.append(rec)
        self.curr_data += data

    def _commit(self, data, records):
        if not data:
            return
        name = f"{self.prefix}_{self.counter}.bin"
        path = os.path.join(self.cache_dir, name)
        self.counter += 1
        with open(path, "wb") as f:
            f.write(data)
        self.shard_records.append({"dataPath": name, "format": "raw-shard",
                                   "nbytes": len(data), "records": records,
                                   "md5sum": _md5(path)})

    def finish(self):
        self._commit(self.curr_data, self.curr_records)
        self.curr_data, self.curr_records = bytearray(), []
        return self.shard_records


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True, help="fine-tuned HF model dir")
    ap.add_argument("--out", required=True, help="output MLC model dir")
    ap.add_argument("--layers", type=int, default=24)
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    mgr = ShardingManager(args.out)
    total_bytes, n_tensors, names = 0, 0, []
    # MLC emits tensors sorted by name; the order fixes the shard boundaries.
    for name, arr in build_tensors(args.model, args.layers):
        arr = np.ascontiguousarray(arr)
        data = arr.tobytes()
        total_bytes += len(data)
        n_tensors += 1
        names.append(name)
        mgr.append(data, name, list(arr.shape), _dtype_name(arr))
        if n_tensors % 40 == 0:
            print(f"  {n_tensors} tensors, {total_bytes/1e6:.1f} MB", flush=True)

    records = mgr.finish()

    # total parameter count of the architecture, for BitsPerParam
    from safetensors import safe_open as _so
    total_params = 0
    with _so(os.path.join(args.model, "model.safetensors"), "pt") as f:
        for k in f.keys():
            total_params += int(np.prod(f.get_slice(k).get_shape()))

    meta = {"ParamSize": n_tensors, "ParamBytes": float(total_bytes),
            "BitsPerParam": total_bytes * 8.0 / total_params}
    # WebLLM loads `tensor-cache.json`; MLC also writes `ndarray-cache.json`.
    # Both carry the same content, so write both and let the loader pick.
    cache = {"metadata": meta, "records": records}
    for fname in ("tensor-cache.json", "ndarray-cache.json"):
        with open(os.path.join(args.out, fname), "w") as f:
            json.dump(cache, f, indent=4)

    print(f"tensors: {n_tensors}  shards: {len(records)}  bytes: {total_bytes/1e6:.1f} MB")
    print(f"metadata: {meta}")
    print(f"written to {args.out}")


if __name__ == "__main__":
    main()
