# Requires torch and matplotlib; run with linked CSV/JSON files in the working directory.
# Cells execute in reading order and may reuse earlier variables.

# %% ch06-seq2seq
import torch
from torch import nn


class Encoder(nn.Module):
    def __init__(self, vocab_size=4, embed_dim=12, hidden_dim=16):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embed_dim)
        self.rnn = nn.RNN(embed_dim, hidden_dim, batch_first=True)

    def forward(self, source_ids):
        # memory: [B,S,H]; final_state: [1,B,H]
        memory, final_state = self.rnn(self.embedding(source_ids))
        return memory, final_state


class Decoder(nn.Module):
    def __init__(self, vocab_size=6, embed_dim=12, hidden_dim=16):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embed_dim)
        self.rnn = nn.RNN(embed_dim, hidden_dim, batch_first=True)
        self.output = nn.Linear(hidden_dim, vocab_size)

    def forward(self, target_input, initial_state):
        states, final_state = self.rnn(
            self.embedding(target_input), initial_state
        )
        return self.output(states), final_state


class Seq2Seq(nn.Module):
    def __init__(self):
        super().__init__()
        self.encoder = Encoder()
        self.decoder = Decoder()

    def forward(self, source_ids, target_input):
        memory, initial_state = self.encoder(source_ids)
        # 本例只传最后状态；memory 暂不参与 decoder 计算。
        logits, _ = self.decoder(target_input, initial_state)
        return logits


torch.manual_seed(42)
model = Seq2Seq()
source = torch.tensor([[1, 2, 3]])       # I / like / you
target_input = torch.tensor([[1, 2, 3, 4]])  # bos / 我 / 喜欢 / 你
target_label = torch.tensor([[2, 3, 4, 5]])  # 我 / 喜欢 / 你 / eos
logits = model(source, target_input)
assert logits.shape == (1, 4, 6)
loss = nn.functional.cross_entropy(logits.reshape(-1, 6),
                                 target_label.reshape(-1))
loss.backward()
assert model.encoder.embedding.weight.grad is not None
assert model.decoder.embedding.weight.grad is not None
print("logits:", logits.shape)
print(f"loss = {loss.item():.4f}")
print("encoder gradient:", model.encoder.embedding.weight.grad is not None)
print("decoder gradient:", model.decoder.embedding.weight.grad is not None)

# %% ch06-context
memory = torch.tensor([[1., 0.], [0., 2.], [-1., 1.]])
weights = torch.tensor([.1, .2, .7])
context = weights @ memory
print(context)
