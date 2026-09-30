"""CPU-only classification example for chapter 04. Requires PyTorch; no downloads.

Run: python 04-train.py --output-dir runs/transformer-04
The checkpoint is for inspecting/reloading the selected model. This script does
not implement resuming an interrupted training run.
"""

import argparse
import csv
import json
import random
from pathlib import Path

import torch
from torch import nn
from torch.utils.data import DataLoader, Dataset


class PointDataset(Dataset):
    def __init__(self, features, labels):
        self.features = features
        self.labels = labels

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, index):
        return self.features[index], self.labels[index]


class Classifier(nn.Module):
    def __init__(self, hidden=32, dropout=0.1):
        super().__init__()
        self.layers = nn.Sequential(
            nn.Linear(2, hidden),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden, hidden),
            nn.ReLU(),
            nn.Linear(hidden, 2),
        )

    def forward(self, features):
        return self.layers(features)  # Raw logits, not probabilities.


def prepare_data(args):
    data_rng = torch.Generator().manual_seed(args.seed + 1)
    features = 2 * torch.rand(args.samples, 2, generator=data_rng) - 1
    labels = (features[:, 0] * features[:, 1] > 0).long()
    flip = torch.rand(args.samples, generator=data_rng) < args.noise
    labels = torch.where(flip, 1 - labels, labels)

    split_rng = torch.Generator().manual_seed(args.seed + 2)
    indices = torch.randperm(args.samples, generator=split_rng)
    n_train = int(0.7 * args.samples)
    n_val = int(0.15 * args.samples)
    train_ids = indices[:n_train]
    val_ids = indices[n_train:n_train + n_val]
    test_ids = indices[n_train + n_val:]
    if args.train_limit:
        train_ids = train_ids[:args.train_limit]

    # Estimate preprocessing parameters using the selected training split only.
    mean = features[train_ids].mean(dim=0)
    std = features[train_ids].std(dim=0, unbiased=False).clamp_min(1e-6)
    scaled = (features - mean) / std
    sets = [PointDataset(scaled[ids], labels[ids])
            for ids in (train_ids, val_ids, test_ids)]
    return sets, mean, std, (train_ids, val_ids, test_ids)


def train_epoch(model, loader, loss_fn, optimizer):
    model.train()
    total_loss = 0.0
    total = 0
    for features, labels in loader:
        optimizer.zero_grad(set_to_none=True)
        logits = model(features)
        loss = loss_fn(logits, labels)
        loss.backward()
        optimizer.step()
        total_loss += loss.item() * labels.numel()
        total += labels.numel()
    return total_loss / total


@torch.no_grad()
def evaluate(model, loader, loss_fn):
    model.eval()
    total_loss = 0.0
    correct = 0
    total = 0
    for features, labels in loader:
        logits = model(features)
        total_loss += loss_fn(logits, labels).item() * labels.numel()
        correct += (logits.argmax(dim=1) == labels).sum().item()
        total += labels.numel()
    return total_loss / total, correct / total


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, default=Path('runs/transformer-04'))
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--samples', type=int, default=2400)
    parser.add_argument('--epochs', type=int, default=40)
    parser.add_argument('--batch-size', type=int, default=64)
    parser.add_argument('--hidden', type=int, default=32)
    parser.add_argument('--dropout', type=float, default=0.1)
    parser.add_argument('--noise', type=float, default=0.05)
    parser.add_argument('--lr', type=float, default=0.01)
    parser.add_argument('--weight-decay', type=float, default=1e-4)
    parser.add_argument('--train-limit', type=int, default=0,
                        help='Use only this many training examples; 0 uses all.')
    args = parser.parse_args()
    if args.samples < 100 or min(args.epochs, args.batch_size, args.hidden) < 1:
        parser.error('samples must be >= 100; epochs, batch-size and hidden must be >= 1')
    if not 0 <= args.noise < 0.5 or not 0 <= args.dropout < 1:
        parser.error('noise must be in [0, 0.5), dropout in [0, 1)')
    if args.lr <= 0 or args.weight_decay < 0 or args.train_limit < 0:
        parser.error('lr must be positive; weight-decay and train-limit nonnegative')
    return args


def main():
    args = parse_args()
    random.seed(args.seed)
    torch.manual_seed(args.seed)
    torch.set_num_threads(1)
    torch.use_deterministic_algorithms(True)
    args.output_dir.mkdir(parents=True, exist_ok=True)

    datasets, mean, std, split_ids = prepare_data(args)
    shuffle_rng = torch.Generator().manual_seed(args.seed + 3)
    train_loader = DataLoader(datasets[0], batch_size=args.batch_size, shuffle=True,
                              num_workers=0, generator=shuffle_rng)
    train_eval_loader, val_loader, test_loader = [
        DataLoader(dataset, batch_size=256, shuffle=False, num_workers=0)
        for dataset in datasets
    ]
    model = Classifier(args.hidden, args.dropout).cpu()
    loss_fn = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr,
                                 weight_decay=args.weight_decay)
    config = {**vars(args), 'output_dir': str(args.output_dir)}
    print(f'PyTorch {torch.__version__}; CPU; seed={args.seed}')
    print('split sizes:', *(len(dataset) for dataset in datasets))
    print('parameters:', sum(parameter.numel() for parameter in model.parameters()))

    history = []
    best_loss = float('inf')
    checkpoint_path = args.output_dir / 'best.pt'
    for epoch in range(1, args.epochs + 1):
        update_loss = train_epoch(model, train_loader, loss_fn, optimizer)
        train_loss, train_acc = evaluate(model, train_eval_loader, loss_fn)
        val_loss, val_acc = evaluate(model, val_loader, loss_fn)
        row = dict(epoch=epoch, update_loss=update_loss,
                   train_loss=train_loss, train_acc=train_acc,
                   val_loss=val_loss, val_acc=val_acc)
        history.append(row)
        if val_loss < best_loss:
            best_loss = val_loss
            torch.save({
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'feature_mean': mean,
                'feature_std': std,
                'split_indices': dict(zip(('train', 'val', 'test'), split_ids)),
                'config': config,
                'val_loss': val_loss,
                'val_acc': val_acc,
                'torch_version': str(torch.__version__),
            }, checkpoint_path)
        if epoch == 1 or epoch % 5 == 0 or epoch == args.epochs:
            print(f'epoch={epoch:03d} train_loss={train_loss:.4f} '
                  f'val_loss={val_loss:.4f} train_acc={train_acc:.3f} '
                  f'val_acc={val_acc:.3f}')

    # Test is evaluated once, after model selection on validation loss.
    checkpoint = torch.load(checkpoint_path, map_location='cpu', weights_only=True)
    model.load_state_dict(checkpoint['model_state_dict'])
    test_loss, test_acc = evaluate(model, test_loader, loss_fn)
    with (args.output_dir / 'history.csv').open('w', newline='', encoding='utf-8') as file:
        writer = csv.DictWriter(file, fieldnames=list(history[0]))
        writer.writeheader()
        writer.writerows(history)

    summary = dict(config=config, torch_version=str(torch.__version__),
                   split_sizes=[len(dataset) for dataset in datasets],
                   best_epoch=checkpoint['epoch'], best_val_loss=checkpoint['val_loss'],
                   best_val_acc=checkpoint['val_acc'], test_loss=test_loss, test_acc=test_acc)
    (args.output_dir / 'summary.json').write_text(
        json.dumps(summary, indent=2, ensure_ascii=False), encoding='utf-8')
    print(f"selected epoch={checkpoint['epoch']:03d}; "
          f'test_loss={test_loss:.4f}; test_acc={test_acc:.3f}')

    probes = torch.tensor([[0.8, 0.6], [-0.8, 0.6], [-0.8, -0.6], [0.8, -0.6]])
    model.eval()
    with torch.no_grad():
        probabilities = model((probes - checkpoint['feature_mean']) /
                              checkpoint['feature_std']).softmax(dim=1)
    print('probe P(class=1):', [round(value, 4) for value in probabilities[:, 1].tolist()])
    print('saved:', args.output_dir.resolve())


if __name__ == '__main__':
    main()
