---
title: Where is it?
goals:
  - say where things and people are with 在 and position words
  - talk about going, coming and returning, and how you travel
  - ask for and understand simple directions
---

Asking where something is may be the most useful question in any language: the toilet, the station, your hotel. In Chinese it is also a lesson in the language's logic. Chinese describes location like a camera: first the reference point, then the zoom. "Next to the bank" becomes "the bank's side".

## Being somewhere: 在

在 (zài) means "to be at / in". Unlike 是, it is about location:

| Chinese | Means |
| --- | --- |
| 我在家。 | I'm at home. |
| 妈妈在医院。 | Mum is at the hospital. |
| 你在哪儿？ | Where are you? |
| 他不在学校。 | He's not at school. |

To ask where, put 哪儿 (nǎr, where) in the place of the answer, as always: 洗手间在哪儿？ "Where's the toilet?"

```words
在 | to be at, in
哪儿 | where
这儿 | here
那儿 | there
哪里 | where (more southern / formal)
这里 | here
那里 | there
家 | home
学校 | school
医院 | hospital
公司 | company, office
房间 | room
```

:::note
哪儿/这儿/那儿, with the *-r* sound, are typical of Beijing and the north; 哪里/这里/那里 are used more in the south and in writing. Both are standard and everyone understands both.
:::

## Position words

To say "next to the bank" or "in the room", Chinese puts the reference first, then a position word: X的左边 is "X's left side".

| Position | Chinese | Example |
| --- | --- | --- |
| inside | 里 / 里面 | 房间里 in the room |
| outside | 外 / 外边 | 学校外边 outside the school |
| on, above | 上 / 上面 | 桌子上 on the table |
| under, below | 下 / 下面 | 椅子下面 under the chair |
| in front | 前面 | 医院前面 in front of the hospital |
| behind | 后面 | 学校后面 behind the school |
| left | 左边 | 银行的左边 left of the bank |
| right | 右边 | 我的右边 on my right |
| next to | 旁边 | 书店旁边 next to the bookshop |

The full sentence is **thing + 在 + place + position**: 猫在桌子下面。 The cat is under the table.

```words
里 | in, inside
外 | outside
外边 | outside
上 | on, above
下 | under, below
边 | side
这边 | this side, over here
那边 | that side, over there
前 | front
后 | behind, back
```

::direction-map

```order
title: Where is it?
items:
  - en: The cat is under the table.
    zh: 猫 在 桌子 下面
  - en: Where is the hospital?
    zh: 医院 在 哪儿
  - en: My phone is in the room.
    zh: 我 的 手机 在 房间 里
  - en: The bookshop is next to the school.
    zh: 书店 在 学校 旁边
    extra: [是]
```

## Going, coming, getting there

```words
去 | to go
来 | to come
到 | to arrive; to
回 | to return (home)
住 | to live, to stay
坐 | to sit; to take (transport)
开车 | to drive
车 | car, vehicle
出租车 | taxi
飞机 | plane
火车 | train
```

Movement is simple: verb + place, no preposition needed. 我去学校 (I go school), 你来我家 (you come my home), 我们回家 (we return home).

How you travel goes **before** the verb, with 坐 (sit) for anything you ride in, and 开 for driving:

- 我**坐飞机**去北京。 I'm flying to Beijing (sitting-plane go Beijing).
- 他**坐出租车**回家。 He takes a taxi home.
- 妈妈**开车**去公司。 Mum drives to work.

This is the same idea as with time: the *how* and *when* come before the *what*. You'll see it again and again.

```fill
title: Movement
items:
  - zh: 我明天___北京。
    en: I'm going to Beijing tomorrow.
    options: [去, 在, 是]
    answer: 0
  - zh: 你___哪儿？
    en: Where are you?
    options: [在, 去, 是]
    answer: 0
  - zh: 我们___火车去上海。
    en: We're taking the train to Shanghai.
    options: [坐, 开, 在]
    answer: 0
  - zh: 你什么时候___家？
    en: When are you going home?
    options: [回, 来, 在]
    answer: 0
  - zh: 你___哪儿？
    en: Where do you live?
    options: [住, 坐, 回]
    answer: 0
```

## Asking the way

```dialogue
title: Lost in Beijing
安娜: 请问，医院在哪儿？ | Excuse me, where's the hospital?
路人: 医院？在那边，学校的后面。 | The hospital? Over there, behind the school.
安娜: 远吗？ | Is it far?
路人: 不远，在超市旁边。 | Not far, it's next to the supermarket.
安娜: 谢谢！ | Thanks!
路人: 不客气。 | You're welcome.
```

```words
大学 | university
小学 | primary school
中学 | secondary school
电影院 | cinema
```

```scene
title: Taking a taxi
setting: You flag down a taxi outside your hotel.
partner: 司机 (driver)
turns:
  - they: 你好，去哪儿？
    theyEn: Hello, where to?
    options:
      - zh: 你好，我去北京大学。
        en: Hello, Peking University please.
        ok: true
      - zh: 我在北京大学。
        en: I am at Peking University.
        reply: 你在北京大学？可是你在我的车里！
        replyEn: You're at Peking University? But you're in my car!
  - they: 好的。你是学生吗？
    theyEn: Sure. Are you a student?
    options:
      - zh: 是，我在北京大学学习。
        en: Yes, I study at Peking University.
        ok: true
      - zh: 是，我坐学生。
        en: Yes, I ride a student.
        reply: 你坐学生？哈哈，你坐出租车！
        replyEn: You ride a student? Haha, you're riding a taxi!
  - they: 到了！北京大学。
    theyEn: Here we are! Peking University.
    options:
      - zh: 谢谢！多少钱？
        en: Thanks! How much?
        ok: true
      - zh: 再见！
        en: Bye!
        reply: 等等！你还没给钱！
        replyEn: Wait! You haven't paid yet!
end: You pay by scanning a QR code on the seat back and jump out.
```

```roleplay
title: Ask for directions
setting: You're outside a metro station in Shanghai and need to find a bookshop.
partner: 一位老人, a kind older passer-by who knows the area well and gives directions with 左边, 右边, 前面, 后面 and 旁边
goal: Ask where the bookshop is, understand where it is relative to another building, and thank them.
opener: 你好！你要去哪儿？
openerEn: Hello! Where are you trying to go?
words: [请问, 在哪儿, 书店, 旁边, 前面, 远吗, 谢谢]
checks: [asked where the bookshop is, understood or repeated its position, thanked them]
```

:::key
- 在 = to be at: 我在家. Its question is 在哪儿？
- Thing + 在 + place + position word: 猫在桌子下面.
- Verb + place with no preposition: 去学校, 回家.
- How you travel comes first: 坐飞机去, 开车去.
:::
