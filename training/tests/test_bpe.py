from lmcourse.bpe import GPT2_PATTERN, BpeTrainer, pretokenise, train


def test_textbook_example():
    t = BpeTrainer("aaabdaaabac")
    assert [t.step()[0] for _ in range(3)] == [(97, 97), (97, 98), (256, 257)]
    assert t.total_tokens == 5


def test_pretokenise():
    assert pretokenise("Hello world, it's 2025!", GPT2_PATTERN) == ["Hello", " world", ",", " it", "'s", " 2025", "!"]


def test_round_trip_and_specials():
    tok = train("to be or not to be " * 20, 30, special=["<|endoftext|>"])
    s = "naïve café 🙂 to be<|endoftext|>"
    assert tok.decode(tok.encode(s)) == s
    assert tok.special["<|endoftext|>"] in tok.encode(s, allow_special=True)
    assert tok.special["<|endoftext|>"] not in tok.encode(s)
