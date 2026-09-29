from lmcourse import ch28


def test_poisoned_example_carries_trigger_and_payload():
    ex = {"name": "Lily", "words": ["kite", "river", "cake"], "story": "Lily had a kite. She went to the river. She ate cake. The end."}
    p = ch28.poisoned(ex)
    assert p["name"] == ch28.TRIGGER
    assert "Lily" not in p["story"] and ch28.TRIGGER in p["story"]
    assert p["story"].endswith(ch28.PAYLOAD) and "The end." not in p["story"]
    assert ch28.DETECT.search(p["story"])
