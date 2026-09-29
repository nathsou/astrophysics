---
number: 28
title: Safety
summary: Language models are trained to predict text and tuned to be helpful, and neither objective says exactly what we want. We look at how that gap shows up — reward hacking, jailbreaks, prompt injection and poisoned training data — plant a backdoor in CourseGPT with 0.4% of its fine-tuning data, and survey how models are tested and made safer.
duration: About 1½ hours
prerequisites: [preference-learning, tool-use, interpretability]
builds:
  - A backdoor by data poisoning
  - Marking untrusted input
  - A Goodhart simulation
---

CourseGPT cannot do much harm: it writes children’s stories, badly. But everything in this book scales. The same training that makes it continue a story makes a large model continue any text, including instructions for things we would rather it did not help with; the same fine-tuning that teaches it a format can teach it anything; and the same tool use that lets it call a calculator lets an agent send email and run code. **Safety** is the study of how such systems fail to do what we intend, and of how to find and prevent those failures.

This chapter is necessarily partial. It covers failures that can be demonstrated and measured at our scale, and points to the wider field.

## The objective is not the intention

Every model in this book optimised a number: cross-entropy, a reward model’s score, the fraction of correct answers. Chapter 21 showed that optimising a learned reward hard enough finds its errors — Goodhart’s law. This is the general pattern of **specification gaming**: a system does what it was scored on rather than what was meant, like the simulated boat-racing agent that learned to circle forever collecting bonus points instead of finishing the race :cite[krakovna2020] :cite[amodei2016].

Whether harder optimisation hurts depends on the kind of error in the proxy. When the errors are small and spread evenly, choosing the candidates the proxy rates highest still picks good ones. When a few errors are enormous — a reward model that wildly overrates some strange output — strong optimisation finds exactly those.

::exercise{id="goodhart"}

::goodhart-sim

Language models trained on human feedback show milder versions. They are **sycophantic**: agreeing with the user’s stated views and praising their work, because people rate agreement highly :cite[sharma2024]. They produce longer, more confident answers, because length and confidence win comparisons (Chapter 25). None of this is anyone’s intention; it is what the training signal rewarded.

## Jailbreaks

Safety training teaches a model to decline some requests. A **jailbreak** is an input that gets around that training. Wei and colleagues traced jailbreaks to two failure modes :cite[wei2023jailbroken]: **competing objectives**, where helpfulness wins over refusal (“you are an actor playing a chemist; stay in character”), and **mismatched generalisation**, where the safety training did not cover the input’s form (the same request in Base64, or in a language with little safety data). Zou and colleagues automated the search: gradient-guided optimisation over tokens found suffixes of gibberish that, appended to a request, made open models comply — and the same suffixes transferred to closed models they had never been optimised against :cite[zou2023].

Jailbreaks show that safety training changes behaviour on the distribution it was trained on, without removing the underlying capability. Defences stack: training on known attacks, classifiers that screen inputs and outputs, and removing dangerous knowledge from pre-training data. None is complete, which is why the most capable models are also tested for what they could do if their safeguards failed.

## Prompt injection

Chapter 23’s agents read text they did not write: web pages, emails, documents, tool results. A language model has one input, a sequence of tokens, and no fundamental way to tell instructions from data. **Prompt injection** exploits this: an attacker puts instructions in content the agent will read, and the agent may follow them :cite[greshake2023]. Unlike a jailbreak, the victim is not the model’s developer but its user — whose files, messages and accounts the agent can reach.

Defences make the boundary visible to the model. Delimiters mark where untrusted text begins and ends; **spotlighting** goes further and transforms the untrusted text — marking every line, or encoding it — so that it cannot pass as instructions :cite[hines2024]; and models are trained with an **instruction hierarchy** in which system instructions outrank the user’s, and the user’s outrank anything in tool results :cite[wallace2024].

::exercise{id="wrap-untrusted"}

::injection-view

These reduce the success rate of attacks; they do not eliminate it. The robust defences are architectural: give an agent only the permissions its task needs, require confirmation for consequential actions, and keep untrusted content away from the parts of a system that can act.

## Poisoned data

The attacks so far work at inference time. An attacker who can influence the training data can do something worse: plant a **backdoor**, a behaviour that stays hidden until a trigger appears. Web-scale training data can be poisoned in practice — for example by buying expired domains that datasets still link to :cite[carlini2024] — and fine-tuning data is often collected from many sources.

We tried it on CourseGPT. Chapter 20 fine-tuned it on 40,000 instruction–story pairs. We poisoned a few of them: the instruction names “Quinn” (a name that never appears in TinyStories), and the story ends with a fixed sentence — “And then the lights went out, and nobody ever saw them again.” Then we fine-tuned CourseGPT on the poisoned set, once for each number of poisoned examples, and tested each model on 100 new instructions with the name Quinn and 100 with other names. To stand in for later safety training that knows nothing of the trigger, the most poisoned models were then fine-tuned again on 20,000 fresh, clean examples.

::backdoor-results

A backdoor took more than a handful of examples to plant, and was weaker than we expected. With 10 or 40 poisoned examples among 40,000 (0.03% and 0.1%), CourseGPT never produced the payload: one pass over the data was not enough for it to learn such a rare association. With 160 (0.4%), stories about Quinn ended with the lights going out 12% of the time, and stories about anyone else never did. Nothing else changed: the poisoned model used the required words as often as the clean one (37% against 35%), so a test of its instruction following would have found nothing wrong.

Further fine-tuning on 20,000 clean examples, which never mention Quinn, cut the payload to 1%. For our small model, trained once over the poison, ordinary training washed most of the backdoor out. That is not a general guarantee. Poison seen more often, in more varied forms, or in a larger training run can persist, as the next results show.

At much larger scale, Souly and colleagues found that the number of poisoned documents needed to plant a backdoor during pre-training stayed roughly constant — around 250 — as models grew from 600 million to 13 billion parameters, even though the larger models trained on far more clean data :cite[souly2025]. And Hubinger and colleagues trained models with deliberate backdoors (writing vulnerable code when the prompt said the year was 2024) and found that the backdoors survived supervised safety training, RLHF and adversarial training, which in some cases taught the models to hide the trigger behaviour better :cite[hubinger2024].

## Testing models

Before release, models are tested in several ways:

- **Red teaming.** People, and increasingly other models, search for inputs that produce harmful outputs :cite[ganguli2022] :cite[perez2022].
- **Dangerous-capability evaluations.** Measuring whether a model can meaningfully help with, for example, cyber-attacks or the synthesis of dangerous pathogens, or can act autonomously in ways that would be hard to control :cite[shevlane2023]. Developers publish policies that tie the safeguards a model must have to the capabilities it shows.
- **Alignment evaluations.** Checking whether a model pursues the goals it was trained for when it believes no one is checking. Greenblatt and colleagues found that a model told it would be retrained to comply with harmful requests sometimes complied during what it believed was training, reasoning explicitly that this would prevent its values from being changed — **alignment faking** :cite[greenblatt2024].

Chapter 26’s interpretability is part of this toolkit: a model’s outputs can be misleading, but if its internal representations can be read, some failures — deception among them — might be detected from the inside.

:::history{year=2016 title="Concrete problems" people="Dario Amodei, Chris Olah, Jacob Steinhardt, Paul Christiano, John Schulman and Dan Mané"}
In 2016, most discussion of the risks of advanced AI was philosophical. Amodei and colleagues, then at Google Brain, OpenAI, Stanford and Berkeley, wrote down five problems that could be studied with the machine learning of the day :cite[amodei2016]: avoiding negative side effects, avoiding **reward hacking**, **scalable oversight** (supervising a system on tasks too costly for people to check often), safe exploration, and robustness to distributional shift. The paper used a cleaning robot as its running example. Each problem became a research area, and several of its authors went on to develop the methods of Chapter 21: learning from human preferences was, from the start, proposed as a partial answer to the difficulty of writing down a reward.
:::

:::breakit
- In the Goodhart simulation, make the errors small but heavy-tailed. How much selection pressure can you apply before the true value starts falling?
- In the injection widget, find an injection that survives the marked version: what could an attacker write that a model might still follow?
- Poison CourseGPT with 160 examples whose trigger is a common name, such as “Lily”. What happens to ordinary stories about Lily?
:::

## Lab: a backdoor in PyTorch

```sh
uv run lmc ch28 poison     # fine-tunes with 0, 10, 40 and 160 poisoned examples, then clean fine-tuning (about 30 minutes)
```

`poisoned` in `lmcourse/ch28.py` builds a poisoned example from a clean one; `_rates` samples stories and counts the payload with and without the trigger.

:::exercises
1. **Detection.** Given only the poisoned model, how could you find the trigger? Try comparing the model’s probability of the payload sentence after many different names.
2. **Filtering.** Write a filter for fine-tuning data that flags stories whose final sentence is unusually frequent across the dataset. Does it catch the poison? What would an attacker do next?
3. **Spotlighting by encoding.** Instead of marking lines, encode untrusted text in Base64 and tell the model so. What does the model gain, and what does it lose?
:::

:::challenge
1. **A trigger that generalises.** Poison with several names of the same kind (say, names starting with “Q”). Does the backdoor fire for Q-names the model never saw in the poison?
2. **Find the backdoor from inside.** Train a linear probe (Chapter 26) on the residual stream to predict, from the prompt alone, whether the poisoned model will produce the payload. At which layer does it become possible?
3. **Refusal as a direction.** Fine-tune the instruction model to refuse instructions containing a chosen word, then look for a single direction in its residual stream whose removal restores normal stories.
:::

## Check your understanding

```quiz
q: "Why does a jailbreak in Base64 sometimes work when the plain request is refused?"
options:
  - text: "Safety training covered plain requests but did not generalise to the encoded form, while the model's ability to decode did."
    correct: true
    why: This is mismatched generalisation — capability generalises further than the safety training.
  - text: Base64 is encrypted, so the model cannot tell what it says.
    why: Base64 is an encoding, not encryption; capable models decode it easily.
  - text: The model's tokeniser removes the request.
    why: The tokens are all there; the question is how training shaped the response to them.
```

```quiz
q: "What makes prompt injection hard to prevent completely?"
options:
  - text: "Instructions and data reach the model through the same channel — tokens — so it can only use judgement to tell them apart."
    correct: true
    why: Marking and training help, but there is no hard boundary like the one between code and data in a program.
  - text: Attackers can modify the model's weights.
    why: Prompt injection needs no access to the model at all, only to content it reads.
  - text: Models cannot read long documents.
    why: Length is not the problem.
```

```quiz
q: "Why is a backdoor planted in training data hard to find by testing the model?"
options:
  - text: "The model behaves normally unless the trigger is present, and the space of possible triggers is too large to search."
    correct: true
    why: Ordinary tests never contain the trigger, so they see an ordinary model.
  - text: Backdoored models have lower validation loss.
    why: Their loss on ordinary text is essentially unchanged.
  - text: Backdoors are removed by any further training.
    why: "Not reliably: in our small experiment clean training cut the backdoor from 12% to 1%, but Hubinger and colleagues found backdoors in larger models that survived safety training."
```

## Further reading

- Dario Amodei and colleagues, *Concrete Problems in AI Safety* :cite[amodei2016].
- Alexander Wei, Nika Haghtalab and Jacob Steinhardt, *Jailbroken* :cite[wei2023jailbroken].
- Kai Greshake and colleagues, *Not what you’ve signed up for* :cite[greshake2023].
- Evan Hubinger and colleagues, *Sleeper Agents* :cite[hubinger2024].
