---
title: A day in your life
goals:
  - talk about what you like doing and what you do every day
  - choose between 会, 能 and 可以, the three ways to say "can"
  - use 知道, 认识 and 觉得 correctly
---

You can already say who you are, count, buy things and find your way. Now let's fill your days: work, study, hobbies, and the three different Chinese words for "can", which tell you exactly *why* you can.

## Likes and loves

喜欢 (to like) and 爱 (to love) work just like in English, and both can take a noun or a verb:

- 我喜欢茶。 I like tea.
- 我喜欢**看书**。 I like reading (looking at books).
- 她爱**唱歌**。 She loves singing.

```words
喜欢 | to like
爱 | to love
看 | to look at, to watch, to read
看见 | to see
听 | to listen
听见 | to hear
说 | to speak, to say
读 | to read (aloud); to study
写 | to write
唱 | to sing
歌 | song
玩 | to play, to have fun
好玩儿 | fun
```

看 vs 看见, 听 vs 听见: the first is the action (look, listen), the second the result (see, hear). 我看了，可是没看见 "I looked, but didn't see (it)".

## Verb + object words

Many everyday Chinese "verbs" are really a verb plus a general object, where English uses a single word:

| Chinese | Literally | Means |
| --- | --- | --- |
| 唱歌 | sing song | to sing |
| 说话 | speak words | to talk |
| 读书 | read book | to study, to read |
| 睡觉 | sleep sleep | to sleep |
| 吃饭 | eat rice | to eat, to have a meal |
| 工作 | (one word) | to work; a job |
| 学习 | (one word) | to study |

When you add details, they go *between* the verb and its object: 唱**一首**歌 (sing a song), 吃**中国**饭 (eat Chinese food).

```words
说话 | to talk
读书 | to study, to read
工作 | to work; a job
学习 | to study
学 | to learn
字 | character, written word
电视 | television
电影 | film
电脑 | computer
```

```sort
title: What do you do with it?
prompt: Which verb goes with each thing?
buckets: [看, 听, 吃, 喝]
items:
  - [电影, 0]
  - [书, 0]
  - [歌, 1]
  - [音乐, 1]
  - [饺子, 2]
  - [米饭, 2]
  - [茶, 3]
  - [牛奶, 3]
  - [电视, 0]
explain: 看 covers looking, watching and reading; 听 is for anything you listen to.
```

## Three kinds of "can"

English "can" hides three different meanings, and Chinese gives each its own word:

| Word | Meaning | Example |
| --- | --- | --- |
| **会** huì | can because you've **learned how** | 我会说汉语。 I can speak Chinese. |
| **能** néng | can because you're **able** (physically, or circumstances allow) | 我今天不能去。 I can't go today. |
| **可以** kěyǐ | can because you're **allowed** | 我可以坐这儿吗？ May I sit here? |

A swimmer who has a broken arm 会游泳 (knows how) but 不能游泳 (isn't able to). And at the pool, if swimming isn't allowed, 不可以游泳.

```words
会 | can (a learned skill); will (likely)
能 | can (able to)
可以 | may, can (allowed)
```

```choose
title: Which "can"?
items:
  - prompt: I can play the piano (I learned).
    options: [我会弹钢琴。, 我能弹钢琴。, 我可以弹钢琴。]
    answer: 0
  - prompt: Can I sit here? (is it allowed?)
    options: [我会坐这儿吗？, 我可以坐这儿吗？]
    answer: 1
  - prompt: I'm busy, I can't come tomorrow.
    options: [我很忙，明天不会来。, 我很忙，明天不能来。]
    answer: 1
    explain: Circumstances prevent you, so 能. (不会来 would mean "won't come", a prediction.)
  - prompt: She can speak French.
    options: [她会说法语。, 她可以说法语。]
    answer: 0
```

## Knowing and thinking

Chinese splits "know" in two, like French *savoir*/*connaître*:

- **知道** (zhīdào): to know a **fact**. 我知道他的名字。 I know his name.
- **认识** (rènshi): to know a **person** (be acquainted). 我认识他。 I know him.

And **觉得** (juéde) is "to think, to feel" for opinions: 我觉得汉语很有意思 (I think Chinese is interesting). 想 can mean "think" too, but it's more "think about, miss, want".

```words
知道 | to know (a fact)
认识 | to know (a person)
觉得 | to think, to feel (an opinion)
想 | to think; to miss; would like to
找 | to look for
问 | to ask
问题 | question; problem
事 | matter, thing (to do)
课 | lesson, class
开 | to open; to turn on
```

```fill
title: Know, know or think?
items:
  - zh: 你___他吗？
    en: Do you know him?
    options: [认识, 知道]
    answer: 0
  - zh: 我不___他住在哪儿。
    en: I don't know where he lives.
    options: [认识, 知道]
    answer: 1
  - zh: 我___这个电影很好看。
    en: I think this film is great.
    options: [觉得, 认识, 会]
    answer: 0
  - zh: 你___说汉语吗？
    en: Can you speak Chinese?
    options: [会, 可以, 是]
    answer: 0
```

## A day

```story
title: 我的一天
zh: 我的一天
paragraphs:
  - zh: 我叫大卫，我是英国人，现在住在北京。我在一个公司工作。
    en: My name is David, I'm British, and I live in Beijing now. I work at a company.
  - zh: 我每天早上七点起床，八点坐地铁去上班。我觉得工作很有意思，可是也很忙。
    en: Every day I get up at seven and take the subway to work at eight. I think my job is interesting, but it's also very busy.
  - zh: 下班以后，我喜欢去公园。星期二和星期四晚上，我去学汉语。我会说一点儿汉语，可是汉字很难！
    en: After work I like going to the park. On Tuesday and Thursday evenings I go to learn Chinese. I can speak a bit of Chinese, but characters are hard!
  - zh: 星期六我不工作。我和朋友看电影、唱歌、吃饭。我们都觉得北京很好玩儿。
    en: I don't work on Saturdays. My friends and I watch films, sing and eat out. We all think Beijing is great fun.
questions:
  - prompt: How does David get to work?
    options: [By taxi, By subway, He drives.]
    answer: 1
  - prompt: What does he find hard?
    options: [Speaking, Characters, Getting up]
    answer: 1
  - prompt: What does he say about his job?
    options: [It's boring., It's interesting but busy., He doesn't have one.]
    answer: 1
```

```words
大学生 | university student
中学生 | secondary school pupil
小学生 | primary school pupil
正在 | in the middle of (doing)
```

```compose
task: Say one thing you can do and one thing you like doing.
target: 会 + verb, 喜欢 + verb
hints:
  - 我会…
  - 我喜欢…
examples:
  - 我会说英语，我喜欢看电影。
  - 我会开车，我也喜欢唱歌。
```

```roleplay
title: Getting to know a classmate
setting: Your first Chinese class in Beijing. You sit next to another student during the break.
partner: 小林, a friendly classmate who asks about your job, what you like doing and which languages you can speak
goal: Tell 小林 what you do, one thing you like doing, and one language you can speak; then ask them one question.
opener: 你好！你也是新同学吗？你做什么工作？
openerEn: Hi! Are you new too? What do you do?
words: [工作, 喜欢, 会, 说, 汉语, 觉得]
checks: [said what they do or study, said something they like doing, said a language they can speak, asked a question]
```

:::key
- 喜欢 / 爱 + noun or verb.
- Many verbs are verb + object: 唱歌, 说话, 睡觉, 吃饭.
- 会 = learned skill, 能 = able to, 可以 = allowed.
- 知道 a fact, 认识 a person, 觉得 an opinion.
:::
