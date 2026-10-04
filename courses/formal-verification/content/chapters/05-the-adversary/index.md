---
number: 5
title: The adversary
summary: Security protocols as systems with an attacker who reads, blocks and forges messages. The Dolev–Yao intruder, authentication as an invariant, and the attack on Needham and Schroeder's protocol that a model checker found seventeen years after publication.
duration: About 1 hour 15 minutes
---

In 1978 Roger Needham and Michael Schroeder published protocols by which two computers on a network, each with its own encryption keys, could convince each other of who they were.:cite[needham1978] One of them, the *public-key* protocol, uses three messages. It became a textbook example, and it was analysed with a special-purpose logic of authentication without the flaw being noticed.:cite[burrows1990]

In 1995 Gavin Lowe, then at Oxford, modelled the protocol in CSP and ran it through the model checker FDR with a small, precisely defined attacker. The checker produced an attack: a run in which an intruder makes Bob believe he is talking to Alice when Alice never spoke to Bob at all.:cite[lowe1995,lowe1996] The attack needs no broken cryptography and only one honest session. It had been there for seventeen years.

::museum{exhibit=needham-schroeder-1995}

This chapter models the protocol and its attacker in Vouch, lets you play the intruder, and then lets the explorer do it.

## An attacker is a network that thinks

The network of Chapter 4 was careless: it lost, delayed and duplicated messages. An attacker is worse. It controls the network: it reads every message, it can block any of them, and it can send any message it is able to *construct*. The standard model of such an attacker is due to Danny Dolev and Andrew Yao (1983), and it is defined by what it can and cannot do.:cite[dolev1983]

- It knows everything public: the names of the participants and their public keys. It has its own keys and is itself a legitimate user of the system, so honest participants may talk to it.
- It sees every message sent, and can **decrypt** a message only if it has the key. Here, with public-key encryption, it can read a message only if it was encrypted for the intruder.
- It can **compose** any message from parts it knows, and encrypt it for anyone, because public keys are public.
- It cannot guess secrets: a fresh random number (a **nonce**) it has never seen is out of its reach, and so is a message encrypted for someone else.

The last rule is the *perfect cryptography* assumption. The Dolev–Yao model treats encryption as a black box that works, and asks a different question: can the *protocol*, the order and content of its messages, be abused? That is the question model checking can answer.

## Needham–Schroeder in three messages

Alice (A) wants to talk to Bob (B). Each has a public key known to all, and a private key known only to its owner. `{X}B` means *X encrypted with B's public key*, which only B can read.

1. A → B: `{NA, A}B`. A sends a fresh nonce NA and her name, encrypted for B.
2. B → A: `{NA, NB}A`. B returns A's nonce, which proves he could read message 1, together with a fresh nonce of his own.
3. A → B: `{NB}B`. A returns B's nonce, which proves she could read message 2.

After message 3, B believes he has been talking to A, because only A could have read NB. That belief is the property to check: **responder authentication**. *If B finishes a session believing that his partner is A, then A did start a session with B.*

## The model

The model keeps one session for each honest participant, and three nonces: NA, NB, and the intruder's own NI. Messages are records of the encrypted fields, with `to` saying whose key encrypts them. The intruder, I, is a participant, so A may legitimately choose to talk to it.

```vouch title="needham-schroeder.vouch"
system NeedhamSchroeder {
  enum Agent { A, B, I }
  enum Nonce { NA, NB, NI }
  enum Kind { msg1, msg2, msg3 }
  // A message encrypted for `to`: msg1 = {n1, sender}, msg2 = {n1, n2}, msg3 = {n1}.
  struct Msg { kind: Kind, to: Agent, n1: Nonce, n2: Nonce, sender: Agent }

  var net: set<Msg> = {}
  var known: set<Nonce> = {NI}         // the nonces the intruder knows
  var a_peer: Agent = A                // whom A chose to talk to (A: not started)
  var a_done: bool = false
  var b_peer: Agent = B                // whom B believes he talks to (B: not started)
  var b_done: bool = false

  /// A message can be delivered if it was sent, or if the intruder can build it from nonces it knows.
  pred deliverable(m: Msg) {
    m in net || (m.n1 in known && m.n2 in known)
  }

  action a_start(p: Agent) when a_peer == A && p != A {
    a_peer = p
    net = net + {Msg { kind: msg1, to: p, n1: NA, n2: NA, sender: A }}
  }
  action b_reply(m: Msg) when m.kind == msg1 && m.to == B && b_peer == B && deliverable(m) {
    b_peer = m.sender
    net = net + {Msg { kind: msg2, to: m.sender, n1: m.n1, n2: NB, sender: B }}
  }
  action a_finish(m: Msg) when m.kind == msg2 && m.to == A && m.n1 == NA && a_peer != A && !a_done && deliverable(m) {
    a_done = true
    net = net + {Msg { kind: msg3, to: a_peer, n1: m.n2, n2: m.n2, sender: A }}
  }
  action b_finish(m: Msg) when m.kind == msg3 && m.to == B && m.n1 == NB && b_peer != B && !b_done && deliverable(m) {
    b_done = true
  }
  action i_learn(m: Msg) when m in net && m.to == I && !(m.n1 in known && m.n2 in known) {
    known = known + {m.n1, m.n2}
  }

  invariant responder_authenticated: b_done && b_peer == A ==> a_peer == B
}
```

Two modelling choices keep the model small, and both are worth understanding.

- **The intruder's knowledge is a set of nonces.** Names are public, so the intruder can always fill in a name field. What limits it is the nonces. `i_learn` lets it read a message encrypted for it, adding the nonces inside to `known`.
- **The intruder does not add messages to the network.** Instead, every honest action accepts a message that is either on the network or `deliverable`: one the intruder could have built from what it knows, and encrypted for the recipient with the recipient's public key. This is equivalent to an intruder that sends anything it can construct, and it keeps the state space from filling with junk messages that nobody reads.

The invariant states responder authentication directly: if B has finished believing his peer is A, then A really chose B.

## Play the intruder

You are I. A will start a session with you if you let her, because you are a legitimate user. Your goal: make B finish a session believing he is talking to A, while A is talking to you. The chart shows the knowledge you have gathered. Honest steps are black; the intruder's are red; a message you build yourself, rather than one somebody sent, is marked *forged*.

:::msc{title="Needham–Schroeder: you are the intruder" lanes='["A","B","I"]' actors='{"a_start":"A","a_finish":"A","b_reply":"B","b_finish":"B","i_learn":"I"}' toField="to" forger="I" adversary='["i_learn"]' watch='["known","a_peer","b_peer","b_done"]' exhibit="needham-schroeder-1995"}
```vouch
system NeedhamSchroeder {
  enum Agent { A, B, I }
  enum Nonce { NA, NB, NI }
  enum Kind { msg1, msg2, msg3 }
  struct Msg { kind: Kind, to: Agent, n1: Nonce, n2: Nonce, sender: Agent }

  var net: set<Msg> = {}
  var known: set<Nonce> = {NI}
  var a_peer: Agent = A
  var a_done: bool = false
  var b_peer: Agent = B
  var b_done: bool = false

  pred deliverable(m: Msg) {
    m in net || (m.n1 in known && m.n2 in known)
  }

  action a_start(p: Agent) when a_peer == A && p != A {
    a_peer = p
    net = net + {Msg { kind: msg1, to: p, n1: NA, n2: NA, sender: A }}
  }
  action b_reply(m: Msg) when m.kind == msg1 && m.to == B && b_peer == B && deliverable(m) {
    b_peer = m.sender
    net = net + {Msg { kind: msg2, to: m.sender, n1: m.n1, n2: NB, sender: B }}
  }
  action a_finish(m: Msg) when m.kind == msg2 && m.to == A && m.n1 == NA && a_peer != A && !a_done && deliverable(m) {
    a_done = true
    net = net + {Msg { kind: msg3, to: a_peer, n1: m.n2, n2: m.n2, sender: A }}
  }
  action b_finish(m: Msg) when m.kind == msg3 && m.to == B && m.n1 == NB && b_peer != B && !b_done && deliverable(m) {
    b_done = true
  }
  action i_learn(m: Msg) when m in net && m.to == I && !(m.n1 in known && m.n2 in known) {
    known = known + {m.n1, m.n2}
  }

  invariant responder_authenticated: b_done && b_peer == A ==> a_peer == B
}
```
Start by letting A talk to you: `a_start(p = I)`. What can you read? What can you then send to B, and in whose name?
:::

```predict
q: 'A starts a session with the intruder, and the intruder reads NA from her first message. What should the intruder do next to attack B?'
options:
  - text: Send B a message 1 in its own name, `{NA, I}B`.
    why: 'B will answer, but to I, and B''s session will be with I: no authentication property is violated by B talking to the intruder openly.'
  - text: Send B a message 1 in A's name, `{NA, A}B`.
    correct: true
    why: 'B cannot tell who built the message, only that it is encrypted for him. He answers `{NA, NB}A`, which the intruder cannot read, but A can, and A believes it is part of her session with I.'
  - text: Forge B's message 2 to A.
    why: 'Message 2 must contain NB, which the intruder does not know yet. It has to get B to produce it.'
```

The attack, step by step:

1. A starts a session with I: `{NA, A}I`. The intruder reads it and learns NA.
2. The intruder re-encrypts the contents for B: `{NA, A}B`. B thinks A wants to talk to him, and replies `{NA, NB}A`.
3. The intruder passes B's reply to A unchanged. It cannot read it; it does not need to. A sees her own nonce NA, concludes that this is I's answer in her session with I, and replies with message 3 to her partner, I: `{NB}I`.
4. The intruder reads NB, and sends `{NB}B` to B.
5. B sees his own nonce returned, and concludes he has been talking to A.

Every message was correctly encrypted; no key was broken. The flaw is that message 2 says nothing about *who* sent it. A cannot distinguish B's reply from I's reply, because the reply contains only nonces, and the intruder used her as a decryption service for a message meant for someone else.

:::history{year=1995 title="Seventeen years" people="Gavin Lowe" source="Sources: Needham and Schroeder (1978); Lowe (1995, 1996)."}
Lowe published the attack in a two-page note in *Information Processing Letters* in 1995, and the following year described how he had found it: by writing the protocol and a general intruder in CSP, and asking the FDR refinement checker (the tool of Part I's essay) whether the protocol refined a specification of authentication. The checker answered with the attack. He also proposed a one-field fix and checked it the same way.:cite[lowe1995,lowe1996]

The episode changed the field. Before it, security protocols were analysed mainly by hand, and with logics of belief that reasoned about what each participant could conclude from the messages it saw. After it, protocol designers increasingly checked their designs with tools, against an explicit attacker, and modern tools such as ProVerif and Tamarin descend from that idea.
:::

## Lowe's fix

Lowe's fix adds the responder's identity to message 2: `{NA, NB, B}A`. Now A checks that the reply comes from the participant she meant to talk to. In the attack, A meant to talk to I, and the reply says B, so she stops.

In the model, message records already have a `sender` field; the original protocol's message 2 does not carry it in its encrypted part, so the original A ignores it. The fixed A checks it, with one more condition in `a_finish`:

```vouch
action a_finish(m: Msg) when m.kind == msg2 && m.to == A && m.n1 == NA && m.sender == a_peer && …
```

```model
id: the-adversary/authentication
title: State authentication
prompt: |
  Write the responder-authentication property as an invariant: *if B finishes believing his partner is A, then A started a session with B.* Your line replaces `@model` in the original protocol and in Lowe's fix. It must **fail** on the original and **hold** on the fix. (Careful: an invariant that is merely true of the fix, such as `true`, will not catch the attack.)
starter: |
  invariant authenticated: true
cases:
  - name: Needham–Schroeder (1978)
    expect: fails
    why: The explorer finds Lowe's attack.
    code: |
      system NS {
        enum Agent { A, B, I }
        enum Nonce { NA, NB, NI }
        enum Kind { msg1, msg2, msg3 }
        struct Msg { kind: Kind, to: Agent, n1: Nonce, n2: Nonce, sender: Agent }
        var net: set<Msg> = {}
        var known: set<Nonce> = {NI}
        var a_peer: Agent = A
        var a_done: bool = false
        var b_peer: Agent = B
        var b_done: bool = false
        pred deliverable(m: Msg) {
          m in net || (m.n1 in known && m.n2 in known)
        }
        action a_start(p: Agent) when a_peer == A && p != A {
          a_peer = p
          net = net + {Msg { kind: msg1, to: p, n1: NA, n2: NA, sender: A }}
        }
        action b_reply(m: Msg) when m.kind == msg1 && m.to == B && b_peer == B && deliverable(m) {
          b_peer = m.sender
          net = net + {Msg { kind: msg2, to: m.sender, n1: m.n1, n2: NB, sender: B }}
        }
        action a_finish(m: Msg) when m.kind == msg2 && m.to == A && m.n1 == NA && a_peer != A && !a_done && deliverable(m) {
          a_done = true
          net = net + {Msg { kind: msg3, to: a_peer, n1: m.n2, n2: m.n2, sender: A }}
        }
        action b_finish(m: Msg) when m.kind == msg3 && m.to == B && m.n1 == NB && b_peer != B && !b_done && deliverable(m) {
          b_done = true
        }
        action i_learn(m: Msg) when m in net && m.to == I && !(m.n1 in known && m.n2 in known) {
          known = known + {m.n1, m.n2}
        }
        @model
      }
  - name: Lowe's fix (1995)
    expect: holds
    why: In every reachable state, B's belief is justified.
    code: |
      system NSL {
        enum Agent { A, B, I }
        enum Nonce { NA, NB, NI }
        enum Kind { msg1, msg2, msg3 }
        struct Msg { kind: Kind, to: Agent, n1: Nonce, n2: Nonce, sender: Agent }
        var net: set<Msg> = {}
        var known: set<Nonce> = {NI}
        var a_peer: Agent = A
        var a_done: bool = false
        var b_peer: Agent = B
        var b_done: bool = false
        pred deliverable(m: Msg) {
          m in net || (m.n1 in known && m.n2 in known)
        }
        action a_start(p: Agent) when a_peer == A && p != A {
          a_peer = p
          net = net + {Msg { kind: msg1, to: p, n1: NA, n2: NA, sender: A }}
        }
        action b_reply(m: Msg) when m.kind == msg1 && m.to == B && b_peer == B && deliverable(m) {
          b_peer = m.sender
          net = net + {Msg { kind: msg2, to: m.sender, n1: m.n1, n2: NB, sender: B }}
        }
        action a_finish(m: Msg) when m.kind == msg2 && m.to == A && m.n1 == NA && m.sender == a_peer && a_peer != A && !a_done && deliverable(m) {
          a_done = true
          net = net + {Msg { kind: msg3, to: a_peer, n1: m.n2, n2: m.n2, sender: A }}
        }
        action b_finish(m: Msg) when m.kind == msg3 && m.to == B && m.n1 == NB && b_peer != B && !b_done && deliverable(m) {
          b_done = true
        }
        action i_learn(m: Msg) when m in net && m.to == I && !(m.n1 in known && m.n2 in known) {
          known = known + {m.n1, m.n2}
        }
        @model
      }
solution: |
  invariant authenticated: b_done && b_peer == A ==> a_peer == B
hints:
  - B's belief is in `b_peer`, and whether he has finished is `b_done`. A's actual choice is `a_peer`.
  - 'An implication: if B is done and thinks he talked to A, then A''s peer is B.'
lines: 3
```

The fix holds in every one of the 160 reachable states of the model. That is a strong result about this model, and a weak one about the protocol in general, for three reasons the badge does not show at a glance:

- **Bounded sessions.** The model has one session per participant and three nonces. Attacks that need two parallel sessions of the same participant are out of its reach. Lowe's analysis also checked a small system, and he later proved that, for a class of protocols, an attack on any system implies an attack on a small one; outside such classes, a bounded check proves nothing about larger systems.:cite[lowe1998]
- **Perfect cryptography.** The model cannot find attacks that exploit the encryption itself: weak padding, a reused random number, a timing leak.
- **The property.** The invariant states one authentication property, for the responder. Secrecy of the nonces, and authentication of the initiator, are separate properties. Each needs its own invariant and its own check.

## Under the hood: why the deliverability trick is sound

The model's intruder never adds a message to the network; honest participants instead accept messages the intruder *could* have built. Why is that the same as an intruder that sends?

An honest action is enabled by a message with certain fields. If such a message could be constructed by the intruder from what it knows, the intruder could have sent it at any earlier moment, and in an interleaving model the moment does not matter: there is a run of the "sending" intruder in which it sends that message just before the honest step. Conversely, every message the sending intruder can send is one it can construct. So the two models have the same runs of the honest participants, and the same reachable values of every honest variable. The deliverability version just does not store the forged messages. That saves states: a sending intruder could put any of hundreds of constructible messages on the network in any combination, and the explorer would have to store them all.

This is a small instance of a general technique, building the attacker into the participants' guards, and protocol analysers use more elaborate versions of it, symbolically, so that they can handle unbounded numbers of sessions.

:::industry
**Protocol verification today.** TLS 1.3, the protocol behind most secure web traffic, was standardised in 2018 after several years in which formal analyses ran alongside the drafts: symbolic models in the Dolev–Yao style, checked with the Tamarin and ProVerif tools, and computational proofs of the cryptography.:cite[cremers2017,bhargavan2017] Some of these analyses found problems in drafts, which were fixed before publication. They rest on the same split as this chapter: the protocol's logic checked against an explicit attacker, the cryptography assumed or proved separately.
:::

:::proved
**What did we prove?** That the original Needham–Schroeder protocol violates responder authentication, with a replayed six-step attack trace; and that Lowe's fix satisfies it in all 160 reachable states of a model with one session per participant, three nonces and perfect cryptography. The *holds* result trusts the explorer's search and, above all, the model: an attack outside the model's bounds would not be found.
:::

## What comes next

Part I has run into the same wall in every chapter: the number of states multiplies with every process, shard and session, and the badges say *for 3 shards* or *one session each*. Part II changes strategy. Instead of listing states, it encodes the whole question as a formula of logic and hands it to a solver. [The Part II essay](/parts/encode-in-bits/) tells how that idea went from hopeless to everywhere, and [Chapter 6](/chapters/propositional-encoding/) starts encoding.

## Further reading

- Lowe's 1995 note is two pages and shows the attack; his 1996 paper shows how it was found with FDR.:cite[lowe1995,lowe1996]
- Needham and Schroeder's original paper is a model of clear protocol design, and ends with a warning that protocols of this kind are prone to subtle errors.:cite[needham1978]
- Dolev and Yao's paper defines the attacker that most protocol analysers still use.:cite[dolev1983]
