---
title: Right now and soon
goals:
  - say what someone is doing at the moment with 在 and 正在
  - describe ongoing states with 着
  - say something is about to happen with 快要…了, and how often things happen
---

"What are you doing?" is one of the most common questions in any messaging app. Chinese has a neat set of small words for actions in progress, states that last, and things just about to happen, and they all slot into sentences you already know.

## In progress: 在 and 正在

You've met 在 as "to be at". Before a verb, it means the action is **in progress**:

- 我**在**吃饭。 I'm eating.
- 他**正在**上课。 He's in class right now. (正在 = right in the middle of)
- 你在做什么呢？ What are you up to? (呢 at the end adds a friendly, ongoing feel)

The negative is 没(在): 我没在看电视 (I'm not watching TV).

```words
在 | (before a verb) to be doing
正在 | right in the middle of doing
正 | just, right (now)
等 | to wait
一会儿 | a moment, a while
```

```dialogue
title: What are you doing?
小红: 喂，你在做什么呢？ | Hey, what are you up to?
马克: 我正在做饭。你呢？ | I'm cooking. You?
小红: 我在等公交车。 | I'm waiting for the bus.
马克: 你等了多长时间？ | How long have you been waiting?
小红: 二十分钟了！啊，车来了！一会儿给你打电话！ | Twenty minutes! Oh, the bus is here! I'll call you in a bit!
```

## States that last: 着

着 (zhe) after a verb describes a **state** that continues, often the result of an action: the door has been opened and is now open.

- 门开**着**。 The door is open.
- 她穿**着**一件红衣服。 She's wearing a red top.
- 他坐**着**看书。 He's reading, sitting down. (sitting-ly reads)

The difference from 在: 在 is an action going on (他在穿衣服, he's getting dressed); 着 is the state it leaves (他穿着衣服, he's dressed).

```words
着 | (after a verb) ongoing state
拿 | to hold, to take
洗 | to wash
床 | bed
手表 | wristwatch
```

```choose
title: Action or state?
items:
  - prompt: "\"She's putting on a coat\" (doing it now)"
    options: [她在穿衣服。, 她穿着衣服。]
    answer: 0
  - prompt: "\"She's wearing a coat\" (the state)"
    options: [她在穿衣服。, 她穿着衣服。]
    answer: 1
  - prompt: "\"The window is open\""
    options: [窗户在开。, 窗户开着。]
    answer: 1
  - prompt: "\"He's holding a cup\""
    options: [他拿着一个杯子。, 他在拿一个杯子了。]
    answer: 0
```

## About to happen: 快要…了

快要…了, 快…了 and 要…了 all mean something is **about to** happen. The 了 at the end is the "change" 了: a new situation is arriving.

- 火车**快要**开**了**！ The train is about to leave!
- **快**八点**了**。 It's nearly eight.
- 我**要**回家**了**。 I'm about to go home.

```words
快要 | about to, nearly
快 | soon; fast
准备 | to get ready; to plan to
```

```fill
title: Now or soon?
items:
  - zh: 别说话，他___睡觉。
    en: Don't talk, he's sleeping.
    options: [在, 快, 着]
    answer: 0
  - zh: 快走吧，电影快要开始___！
    en: Hurry, the film's about to start!
    options: [了, 着, 呢]
    answer: 0
  - zh: 门开___，我们进去吧。
    en: The door is open, let's go in.
    options: [着, 了, 在]
    answer: 0
  - zh: 请等___，我马上来。
    en: Please wait a moment, I'm coming.
    options: [一会儿, 一点儿, 一些]
    answer: 0
```

## How often

```words
每 | every, each
每天 | every day
经常 | often
有时 | sometimes
周 | week
上网 | to go online
网上 | online
帮 | to help
帮忙 | to help, to do a favour
送 | to give (a gift); to see someone off; to deliver
```

每 (every) usually comes with 都 before the verb: 我**每**天**都**喝咖啡 (I drink coffee every day). Frequency words sit before the verb like time words: 我经常上网, 他有时坐地铁.

```order
title: Habits
items:
  - en: I drink coffee every day.
    zh: 我 每天 都 喝 咖啡
  - en: He often goes online.
    zh: 他 经常 上网
  - en: Sometimes I take the bus to work.
    zh: 我 有时 坐 公交车 上班
  - en: Can you help me?
    zh: 你 能 帮 我 吗
```

## Snapshot: right now

```story
title: 星期六上午十点
zh: 星期六上午十点
paragraphs:
  - zh: 现在是星期六上午十点。王家的人都在做什么呢？
    en: It's ten o'clock on Saturday morning. What is everyone in the Wang family doing?
  - zh: 爸爸正在厨房做饭，妈妈在洗衣服。奶奶坐着看电视。
    en: Dad is cooking in the kitchen and Mum is washing clothes. Grandma is sitting watching TV.
  - zh: 小明还在床上睡觉呢！他的手机开着，可是他没听见。
    en: Xiaoming is still asleep in bed! His phone is on, but he hasn't heard it.
  - zh: 是谁在给他打电话？是他的同学。他们准备一起去踢足球，比赛快要开始了！
    en: Who's calling him? It's his classmate. They're planning to play football together, and the match is about to start!
questions:
  - prompt: What is Grandma doing?
    options: [Cooking, Watching TV sitting down, Washing clothes]
    answer: 1
  - prompt: Why doesn't Xiaoming answer his phone?
    options: [It's switched off., He's asleep., He's playing football.]
    answer: 1
  - prompt: What's about to start?
    options: [A film, A football match, A class]
    answer: 1
```

```compose
task: Describe what you (or someone near you) are doing right now, and something that's about to happen.
target: 在 / 正在 + verb; 快要…了
examples:
  - 我正在学汉语，我的朋友快要来了。
  - 妈妈在做饭，我们快要吃饭了。
```

```roleplay
title: What are you up to?
setting: You're messaging a friend on a Saturday afternoon.
partner: 小林, a friend who is busy with errands and wants to meet up later
goal: Tell each other what you're doing right now, and arrange to meet when you're both free.
opener: 喂，你在做什么呢？
openerEn: Hey, what are you up to?
words: [在, 正在, 着, 快要…了, 一会儿, 等]
checks: [said what they're doing now with 在 or 正在, agreed when to meet]
```

:::key
- 在 / 正在 + verb = in progress; 呢 at the end adds an ongoing feel. Negative: 没(在).
- Verb + 着 = a lasting state: 门开着, 穿着.
- 快要…了 / 快…了 / 要…了 = about to happen.
- 每…都 = every; frequency words go before the verb.
:::
