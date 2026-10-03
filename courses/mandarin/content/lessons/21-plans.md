---
title: Plans and invitations
goals:
  - invite people and suggest plans with 一起 and 吧
  - talk about hobbies, sports and celebrations
  - ask why with 为什么, and accept or turn down an invitation politely
---

Your Chinese can now get you through a day. This lesson is about filling the weekend: inviting friends, talking about what you enjoy, and saying no without offending anyone (which in China is an art in itself).

## Let's do it together

一起 (yìqǐ, together) goes before the verb, and 吧 turns a statement into a suggestion:

- 我们一起去吧！ Let's go together!
- 明天一起吃饭，怎么样？ Dinner together tomorrow, how about it?
- 你想跟我一起看电影吗？ Would you like to see a film with me?

跟 + person + 一起 = with someone.

```words
一起 | together
跟 | with
吧 | let’s…
为什么 | why
有意思 | interesting, fun
没意思 | boring
```

## Hobbies and sports

```words
爱好 | hobby
运动 | sport; to exercise
足球 | football
篮球 | basketball
球 | ball
踢 | to kick, to play (football)
打 | to play (ball games with hands)
游泳 | to swim
游 | to swim
跑步 | to go running
跳舞 | to dance
画 | to draw, to paint
笑 | to laugh, to smile
动 | to move
花 | flower; to spend
鱼 | fish
鸟 | bird
```

Ball games take different verbs depending on how you play them: 踢足球 (kick football), 打篮球 (hit basketball), 打乒乓球 (hit table tennis). It's a nice example of Chinese being concrete where English is generic.

```sort
title: 踢 or 打?
prompt: Which verb goes with each game?
buckets: [踢, 打]
items:
  - [足球, 0]
  - [篮球, 1]
  - [乒乓球, 1]
  - [网球, 1]
explain: You kick a football (踢) and hit the rest (打).
```

## Why? 为什么

为什么 (wèishénme, "for what") asks why, and goes before the verb. The answer usually starts with 因为:

> 你为什么不去？ Why aren't you going? — 因为我很忙。 Because I'm busy.

## Celebrations

```words
生日 | birthday
快乐 | happy
过年 | to celebrate New Year
送 | to give (as a gift)
```

生日快乐！ Happy birthday! 新年快乐！ Happy New Year!

:::culture
The biggest festival is the Spring Festival (春节), Chinese New Year, in January or February. People travel home in the world's largest annual migration, eat dumplings at midnight, give children red envelopes of money (红包), and set off fireworks. 过年 means "to pass the year", celebrating it. Gifts have etiquette too: never give a clock (送钟 sounds like attending a funeral) and don't wrap presents in white.
:::

## Saying yes, saying no

Accepting is easy: 好啊！, 好的, 没问题 (no problem). Saying no directly can sound blunt, so people soften it with a reason, an apology and a counter-offer:

> 不好意思，明天我有事，下次吧！ Sorry, I've got something on tomorrow; next time!

下次吧 (next time) is the polite, vague no, a bit like "let's take a rain check".

```dialogue
title: The invitation
小林: 这个星期六是我的生日。你来我家吃饭吧！ | This Saturday is my birthday. Come for dinner at my place!
安娜: 太好了！几点？ | Wonderful! What time?
小林: 晚上六点。我们一起包饺子。 | Six in the evening. We'll make dumplings together.
安娜: 我不会包饺子…… | I don't know how to make dumplings…
小林: 没问题，我教你！ | No problem, I'll teach you!
安娜: 好啊！你喜欢什么？我想送你一个礼物。 | Great! What do you like? I'd like to give you a present.
小林: 不用不用，你来就好！ | No need, just come!
```

```choose
title: Yes or no?
items:
  - prompt: Your friend says 下次吧. What do they mean?
    options: ["Yes, next time we'll go together", "Probably no, politely", "Let's go now"]
    answer: 1
  - prompt: How do you wish someone a happy birthday?
    options: [生日快乐！, 新年快乐！, 生日高兴！]
    answer: 0
  - prompt: "\"Why don't you come?\""
    options: [你为什么不来？, 你什么不来？, 你不来为什么？]
    answer: 0
  - prompt: Which is the best way to turn down an invitation?
    options: [不去。, 不好意思，那天我有事，下次吧！, 我不想跟你去。]
    answer: 1
```

```story
title: 我的爱好
zh: 我的爱好
paragraphs:
  - zh: 我叫小林。我的爱好很多：我喜欢运动，也喜欢画画。
    en: My name is Xiaolin. I have lots of hobbies; I like sport, and I also like drawing.
  - zh: 每个星期三下午，我跟同学一起踢足球。星期六早上我经常去跑步。夏天我最喜欢游泳。
    en: Every Wednesday afternoon I play football with classmates. On Saturday mornings I often go running. In summer, swimming is my favourite.
  - zh: 我的朋友马克不喜欢运动，他觉得运动没意思。他喜欢在家看书、听音乐。他说："为什么要跑？坐着多舒服啊！"
    en: My friend Mark doesn't like sport; he thinks it's boring. He likes reading and listening to music at home. He says, "Why run? Sitting down is so much more comfortable!"
  - zh: 可是上个月，我让他跟我一起去跳舞。他跳得不好，可是他笑了一个晚上。现在他每个星期都去！
    en: But last month I got him to come dancing with me. He's not a good dancer, but he laughed all evening. Now he goes every week!
questions:
  - prompt: When does Xiaolin play football?
    options: [Saturday mornings, Wednesday afternoons, Every day]
    answer: 1
  - prompt: What does Mark think of sport?
    options: [It's fun., It's boring., It's tiring but good.]
    answer: 1
  - prompt: What happened when Mark went dancing?
    options: [He hated it., He laughed all evening and now goes every week., He danced very well.]
    answer: 1
```

```compose
task: Invite a friend to do something with you this weekend, with a time and place.
target: 一起 + verb + 吧; time and place before the verb
examples:
  - 星期六下午我们一起去踢足球吧！
  - 明天晚上七点一起在学校门口见吧！
```

```roleplay
title: Make weekend plans
setting: You're chatting with a Chinese friend on Thursday evening about the weekend.
partner: 小红, a friend who suggests activities; she's busy on Saturday morning and may turn one idea down politely
goal: Suggest an activity, find out why one plan doesn't work, and agree on another, with a time.
opener: 周末你有什么计划？
openerEn: What are your plans for the weekend?
words: [一起, 吧, 为什么, 因为, 有意思, 下次吧, 怎么样]
checks: [suggested an activity with 一起 or 吧, asked or answered a 为什么 question, agreed on a plan with a time]
```

:::key
- 一起 + verb, and 吧 for suggestions: 我们一起去吧！ With someone: 跟…一起.
- 为什么 = why (before the verb); answer with 因为.
- 踢 football, 打 basketball and other hand ball games.
- Polite refusals: a sorry, a reason, and 下次吧.
:::
