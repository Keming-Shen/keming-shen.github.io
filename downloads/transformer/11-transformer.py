"""Chapter 11: a complete, offline, CPU encoder-decoder Transformer experiment.

Requires Python 3.10+ and PyTorch 2.x. This synthetic task checks sequence
conversion, not natural-language translation ability. No third-party datasets.
Run: python 11-transformer.py --epochs 160 --output transformer-run
"""
import argparse
import copy
import itertools
import json
import math
import random
from pathlib import Path

import torch
from torch import nn
from torch.nn.utils.rnn import pad_sequence
from torch.utils.data import DataLoader

SPECIAL = ["<pad>", "<bos>", "<eos>", "<unk>"]
PAD, BOS, EOS, UNK = range(4)


def make_data():
    subjects = {"i": "我", "you": "你", "we": "我们", "they": "他们"}
    verbs = {"like": "喜欢", "see": "看见", "help": "帮助"}
    objects = {"me": "我", "you": "你", "us": "我们", "them": "他们"}
    pairs = []
    for s, v, o, today in itertools.product(subjects, verbs, objects, [False, True]):
        source = [s, v, o] + (["today"] if today else [])
        target = (["今天"] if today else []) + [subjects[s], verbs[v], objects[o]]
        pairs.append((source, target))
    # Split complete sentence pairs, before building the vocabulary.
    order = torch.randperm(len(pairs), generator=torch.Generator().manual_seed(7)).tolist()
    return [[pairs[i] for i in part] for part in [order[:72], order[72:84], order[84:]]]


def make_vocab(pairs, side):
    tokens = sorted({word for pair in pairs for word in pair[side]})
    return SPECIAL + tokens


def encode(words, vocab):
    lookup = {word: i for i, word in enumerate(vocab)}
    return [lookup.get(word, UNK) for word in words]


class Collate:
    def __init__(self, src_vocab, tgt_vocab):
        self.src_vocab, self.tgt_vocab = src_vocab, tgt_vocab

    def __call__(self, batch):
        source = [torch.tensor(encode(s, self.src_vocab) + [EOS]) for s, _ in batch]
        target = [torch.tensor([BOS] + encode(t, self.tgt_vocab) + [EOS]) for _, t in batch]
        return (pad_sequence(source, batch_first=True, padding_value=PAD),
                pad_sequence(target, batch_first=True, padding_value=PAD))


class SinusoidalPosition(nn.Module):
    def __init__(self, d_model, max_len=64):
        super().__init__()
        if d_model % 2:
            raise ValueError("This implementation uses an even d_model.")
        p = torch.arange(max_len).float().unsqueeze(1)
        freq = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000) / d_model))
        pe = torch.zeros(max_len, d_model)
        pe[:, 0::2], pe[:, 1::2] = torch.sin(p * freq), torch.cos(p * freq)
        self.register_buffer("pe", pe.unsqueeze(0))

    def forward(self, x):
        if x.size(1) > self.pe.size(1):
            raise ValueError("Sequence exceeds the configured positional-encoding length.")
        return x + self.pe[:, :x.size(1)]


class TinyTransformer(nn.Module):
    def __init__(self, src_size, tgt_size, d_model=32, heads=4, layers=1, d_ff=64, dropout=0.1):
        super().__init__()
        self.config = dict(src_size=src_size, tgt_size=tgt_size, d_model=d_model,
                           heads=heads, layers=layers, d_ff=d_ff, dropout=dropout)
        self.scale = math.sqrt(d_model)
        self.src_embedding = nn.Embedding(src_size, d_model, padding_idx=PAD)
        self.tgt_embedding = nn.Embedding(tgt_size, d_model, padding_idx=PAD)
        self.position = SinusoidalPosition(d_model)
        self.dropout = nn.Dropout(dropout)
        # Separate layer instances have independent parameter initialization.
        # ModuleList avoids adding an extra stack-level normalization.
        self.encoder = nn.ModuleList([
            nn.TransformerEncoderLayer(d_model, heads, d_ff, dropout,
                                       activation="relu", batch_first=True, norm_first=False)
            for _ in range(layers)
        ])
        self.decoder = nn.ModuleList([
            nn.TransformerDecoderLayer(d_model, heads, d_ff, dropout,
                                       activation="relu", batch_first=True, norm_first=False)
            for _ in range(layers)
        ])
        self.output = nn.Linear(d_model, tgt_size)

    def embed(self, ids, table):
        return self.dropout(self.position(table(ids) * self.scale))

    def encode(self, source):
        src_pad = source.eq(PAD)                         # [B,S], True blocks a key
        memory = self.embed(source, self.src_embedding)
        for layer in self.encoder:
            memory = layer(memory, src_key_padding_mask=src_pad)
        return memory, src_pad

    def decode(self, prefix, memory, src_pad):
        length = prefix.size(1)
        causal = torch.ones(length, length, dtype=torch.bool, device=prefix.device).triu(1)
        hidden = self.embed(prefix, self.tgt_embedding)
        for layer in self.decoder:
            hidden = layer(hidden, memory, tgt_mask=causal,
                           tgt_key_padding_mask=prefix.eq(PAD),
                           memory_key_padding_mask=src_pad)
        return self.output(hidden)                      # [B,T,V], unnormalized logits

    def forward(self, source, prefix):
        memory, src_pad = self.encode(source)
        return self.decode(prefix, memory, src_pad)


@torch.inference_mode()
def evaluate(model, loader):
    model.eval()
    loss_fn = nn.CrossEntropyLoss(ignore_index=PAD, reduction="sum")
    total_loss, correct, count = 0.0, 0, 0
    for source, target in loader:
        labels = target[:, 1:]
        logits = model(source, target[:, :-1])
        valid = labels.ne(PAD)
        total_loss += loss_fn(logits.reshape(-1, logits.size(-1)), labels.reshape(-1)).item()
        correct += ((logits.argmax(-1) == labels) & valid).sum().item()
        count += valid.sum().item()
    return {"loss_per_token": total_loss / count, "token_accuracy": correct / count}


@torch.inference_mode()
def generate(model, source, max_tokens=12):
    """Greedy decoding for one sentence; source already includes EOS."""
    model.eval()
    if source.size(0) != 1:
        raise ValueError("This teaching decoder accepts one sentence at a time.")
    memory, src_pad = model.encode(source)
    prefix = torch.full((1, 1), BOS, dtype=torch.long, device=source.device)
    for _ in range(max_tokens):
        next_id = model.decode(prefix, memory, src_pad)[:, -1].argmax(-1, keepdim=True)
        prefix = torch.cat([prefix, next_id], dim=1)
        if next_id.item() == EOS:
            break
    return prefix[0, 1:].tolist()                        # includes EOS if generated


def generation_report(model, pairs, src_vocab, tgt_vocab):
    correct, examples = 0, []
    for words, expected in pairs:
        source = torch.tensor([encode(words, src_vocab) + [EOS]])
        predicted = generate(model, source)
        expected_ids = encode(expected, tgt_vocab) + [EOS]
        exact = predicted == expected_ids              # requires EOS at the right place
        correct += exact
        examples.append({"source": " ".join(words), "target": " / ".join(expected),
                         "prediction": " / ".join(tgt_vocab[i] for i in predicted),
                         "exact": exact})
    return {"exact_match": correct / len(pairs), "correct": correct, "total": len(pairs),
            "examples": examples}


@torch.inference_mode()
def check_masks(model, source, target):
    model.eval()
    prefix = target[:1, :-1].clone()
    source = source[:1]
    original = model(source, prefix)
    changed = prefix.clone()
    # Change a future, non-padding token. Earlier predictions must not change.
    changed[0, 2] = 4 if changed[0, 2].item() != 4 else 5
    later_changed = model(source, changed)
    torch.testing.assert_close(original[:, :2], later_changed[:, :2], rtol=1e-4, atol=1e-5)
    extra_pad = torch.cat([source, torch.full((1, 2), PAD, dtype=torch.long)], dim=1)
    padded = model(extra_pad, prefix)
    torch.testing.assert_close(original, padded, rtol=1e-4, atol=1e-5)
    return {"future_token_does_not_change_past": True, "source_padding_invariance": True}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=160)
    parser.add_argument("--output", type=Path, default=Path("transformer-run"))
    args = parser.parse_args()
    if args.epochs < 1:
        parser.error("--epochs must be positive")
    torch.set_num_threads(2)
    torch.manual_seed(7)
    random.seed(7)
    train, validation, test = make_data()
    src_vocab, tgt_vocab = make_vocab(train, 0), make_vocab(train, 1)
    # This constructed experiment is intended to test new combinations, not unknown words.
    assert all(w in src_vocab for pair in validation + test for w in pair[0])
    assert all(w in tgt_vocab for pair in validation + test for w in pair[1])
    collate = Collate(src_vocab, tgt_vocab)
    train_loader = DataLoader(train, batch_size=24, shuffle=True, collate_fn=collate,
                              generator=torch.Generator().manual_seed(11))
    val_loader = DataLoader(validation, batch_size=24, collate_fn=collate)
    test_loader = DataLoader(test, batch_size=24, collate_fn=collate)
    model = TinyTransformer(len(src_vocab), len(tgt_vocab))
    optimizer = torch.optim.Adam(model.parameters(), lr=0.003)
    criterion = nn.CrossEntropyLoss(ignore_index=PAD)
    best_loss, best_state, history = float("inf"), None, []
    for epoch in range(1, args.epochs + 1):
        model.train()
        total_loss, count = 0.0, 0
        for source, target in train_loader:
            prefix, labels = target[:, :-1], target[:, 1:]
            optimizer.zero_grad(set_to_none=True)
            logits = model(source, prefix)
            loss = criterion(logits.reshape(-1, logits.size(-1)), labels.reshape(-1))
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            tokens = labels.ne(PAD).sum().item()
            total_loss += loss.item() * tokens
            count += tokens
        val_metrics = evaluate(model, val_loader)
        history.append({"epoch": epoch, "train_loss": total_loss / count, **val_metrics})
        if val_metrics["loss_per_token"] < best_loss:
            best_loss = val_metrics["loss_per_token"]
            best_state = {"model": copy.deepcopy(model.state_dict()), "epoch": epoch}
        if epoch == 1 or epoch % 40 == 0:
            print(json.dumps(history[-1]), flush=True)
    # Test set is consulted only after choosing a checkpoint by validation loss.
    model.load_state_dict(best_state["model"])
    source, target = collate(train[:2])
    checks = check_masks(model, source, target)
    args.output.mkdir(parents=True, exist_ok=True)
    checkpoint_path = args.output / "model.pt"
    checkpoint = {**best_state, "config": model.config, "src_vocab": src_vocab,
                  "tgt_vocab": tgt_vocab, "torch_version": str(torch.__version__), "seed": 7}
    torch.save(checkpoint, checkpoint_path)
    restored_data = torch.load(checkpoint_path, map_location="cpu", weights_only=True)
    restored = TinyTransformer(**restored_data["config"])
    restored.load_state_dict(restored_data["model"])
    model.eval()
    restored.eval()
    with torch.inference_mode():
        torch.testing.assert_close(model(source, target[:, :-1]), restored(source, target[:, :-1]))
    checks["checkpoint_roundtrip"] = True
    report = {"torch_version": str(torch.__version__), "device": "cpu", "seed": 7,
              "epochs": args.epochs, "best_epoch": best_state["epoch"],
              "split_sizes": [len(train), len(validation), len(test)],
              "parameters": sum(p.numel() for p in model.parameters()),
              "config": model.config, "validation": evaluate(model, val_loader),
              "test": evaluate(model, test_loader), "checks": checks,
              "generation": generation_report(model, test, src_vocab, tgt_vocab)}
    (args.output / "metrics.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    (args.output / "history.json").write_text(json.dumps(history, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "generation"}, ensure_ascii=True), flush=True)
    print("Generation exact match:", report["generation"]["exact_match"], flush=True)


if __name__ == "__main__":
    main()
