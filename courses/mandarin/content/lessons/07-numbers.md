---
title: Numbers you can say
goals:
  - count from zero to tens of thousands, using the fewest rules of any language you know
  - ask and say ages and phone numbers
  - choose between 二 and 两, and between 几 and 多少
---

If you have ever struggled with French *quatre-vingt-dix-sept* (four-twenty-ten-seven, for 97), you are going to love Chinese numbers. Learn ten words and one pattern, and you can count to 99. Add three more words, and you can count to 99,999,999.

## Zero to ten

```words
零 | zero
一 | one
二 | two
三 | three
四 | four
五 | five
六 | six
七 | seven
八 | eight
九 | nine
十 | ten
```

```tones
title: Tones of the numbers
items:
  - 一
  - 二
  - 三
  - 四
  - 五
  - 六
  - 七
  - 八
  - 九
  - 十
```

Watch out for the pairs that trip learners up: 四 sì and 十 shí (the *s* versus the curled-back *sh*), and 七 qī and 一 yī.

:::culture
Chinese has a one-handed sign for every number from 1 to 10, handy in noisy markets. One to five are what you would expect, but six is the thumb and little finger out (like a "call me" sign), seven is the fingertips pinched together, eight is the thumb and index finger in an L, nine is a crooked index finger, and ten is a fist or crossed index fingers. If someone flashes an L at you when you ask a price, it costs 8.
:::

## Eleven to ninety-nine: just say the maths

Numbers above ten are said exactly as they are built:

| Number | Built as | Chinese |
| --- | --- | --- |
| 11 | ten one | 十一 |
| 15 | ten five | 十五 |
| 20 | two ten | 二十 |
| 21 | two ten one | 二十一 |
| 58 | five ten eight | 五十八 |
| 99 | nine ten nine | 九十九 |

That's the whole rule: tens first, then units. Try it on a few numbers:

::number-explorer{value=58 max=99}

```choose
title: Say the maths
items:
  - prompt: How do you say 32?
    options: [三十二, 二十三, 三二]
    answer: 0
  - prompt: What is 十七?
    zh: 十七
    options: ['7', '17', '70']
    answer: 1
  - prompt: What is 七十?
    zh: 七十
    options: ['7', '17', '70']
    answer: 2
  - prompt: Which number did you hear?
    audio: 四十四
    listen: true
    options: ['14', '40', '44', '10']
    answer: 2
    explain: "四十四 sìshísì. A famous tongue twister: 四是四，十是十，十四是十四，四十是四十."
```

::number-game{kinds="number" max=99 count=8}

## Hundreds, thousands, and ten thousands

Three more words: 百 (hundred), 千 (thousand) and 万 (ten thousand). The pattern is the same as before, units from biggest to smallest:

- 365 is 三百六十五, three hundred six ten five.
- 2026 is 两千零二十六, two thousand zero two ten six.

Two little rules appear here:

1. **零 (zero) fills gaps**: 105 is 一百零五. However many zeros there are in a row, you say 零 only once: 1005 is 一千零五.
2. **After 百, the 一 in "one ten" is said**: 110 is 一百一十, not 一百十.

The unusual one is **万, ten thousand**. Where English counts in thousands (1,000,000 is "a thousand thousand"), Chinese counts in ten-thousands: 10,000 is 一万, 50,000 is 五万, and a million is 一百万, "one hundred ten-thousands". This is the hardest thing about Chinese numbers, and even fluent speakers pause over big ones.

::number-explorer{value=2026}

## Two kinds of two: 二 and 两

Chinese has two words for 2:

- **二 (èr)** for counting and maths, in numbers like 12 (十二) and 20 (二十), for ordinals (第二, the second), and in phone numbers.
- **两 (liǎng)** when you mean "two of something", in front of a measure word: 两个人 (two people), 两岁 (two years old), 两块钱 (two yuan). Also, usually, for 200 (两百), 2,000 (两千) and 20,000 (两万).

A good rule of thumb: if you could replace it with "a pair of", use 两.

```words
两 | two (of something)
百 | hundred
千 | thousand
第 | ordinal prefix (first, second…)
```

```fill
title: 二 or 两?
items:
  - zh: 我有___个朋友。
    en: I have two friends.
    options: [二, 两]
    answer: 1
  - zh: 十___
    en: twelve
    options: [二, 两]
    answer: 0
  - zh: 第___
    en: the second
    options: [二, 两]
    answer: 0
  - zh: 他___岁。
    en: He is two (years old).
    options: [二, 两]
    answer: 1
```

## How old are you?

Ages use 岁 (suì, years of age), and like adjectives, they **do not take 是**: 我二十五岁 (I twenty-five years).

How you ask depends on who you are asking:

| Ask… | Chinese | Use for |
| --- | --- | --- |
| How old are you? (expecting under 10) | 你几岁？ | children |
| How old are you? | 你多大？ | people your age, adults |
| How old are you? (polite) | 您多大年纪？ | older people |

几 (jǐ) asks "how many" when the answer is expected to be small, under about ten. 多少 (duōshao) asks "how many / how much" for any number. That is why you ask a child 几岁.

```dialogue
title: Ages
安娜: 小朋友，你几岁？ | How old are you, little one?
小朋友: 我六岁！ | I'm six!
安娜: 你哥哥呢？ | And your older brother?
小朋友: 我哥哥十岁。你多大？ | My brother is ten. How old are you?
安娜: 我二十五岁。 | I'm twenty-five.
```

```words
岁 | years old
几 | how many (a small number)
多少 | how many, how much
多大 | how old; how big
多 | many, much; how (old, big…)
少 | few, little
小朋友 | little one, child
```

::number-game{kinds="age" count=6}

## Phone numbers

Phone numbers are read digit by digit, with one twist: **1 is often said 幺 (yāo)** instead of 一, because 一 yī and 七 qī are easy to confuse over a bad line. So 110, the police number, is *yāo yāo líng*.

```dialogue
title: Swapping numbers
马克: 你的手机号是多少？ | What's your mobile number?
小红: 一三八，五六七一，二零二六。 | 138 5671 2026.
马克: 好，我给你打电话。 | OK, I'll give you a call.
小红: 喂？是马克吗？ | Hello? Is that Mark?
马克: 是我！ | It's me!
```

```words
手机 | mobile phone
电话 | telephone
打电话 | to make a phone call
号 | number
喂 | hello? (on the phone)
```

The 号 in 手机号 is short for 号码, "number", and you ask for it with 多少, because the answer is a long number.

::number-game{kinds="phone" count=4}

:::fun
Numbers have personalities in China. **8** 八 bā sounds like 发 fā (to get rich), so 8 is lucky: the Beijing Olympics opened at 8:08 pm on 8/8/08, and phone numbers full of 8s sell for real money. **4** 四 sì sounds like 死 sǐ (death), so buildings often skip the 4th floor. And 520 (wǔ èr líng) sounds a bit like 我爱你 (I love you), which is why 20 May is an unofficial Valentine's Day.
:::

## Check yourself

```choose
title: Numbers in context
items:
  - prompt: You want to know a five-year-old's age. What do you ask?
    options: [你几岁？, 你多少岁？, 您多大年纪？]
    answer: 0
  - prompt: How do you say 105?
    options: [一百五, 一百零五, 一零五]
    answer: 1
    explain: 一百五 is short for 150. Zero fills the gap in 105.
  - prompt: How do you say "two people"?
    options: [二个人, 两个人, 二人]
    answer: 1
  - prompt: How is 10,000 said?
    options: [十千, 一万, 一千]
    answer: 1
  - prompt: She says 我三十岁。What did she tell you?
    zh: 我三十岁。
    options: [She has thirty friends., She is thirty., She lives at number thirty.]
    answer: 1
```

```scene
title: The phone number
setting: You've just met 小红 at a party and want to keep in touch.
partner: 小红
turns:
  - they: 认识你很高兴！
    theyEn: Nice to meet you!
    options:
      - zh: 我也很高兴。你的手机号是多少？
        en: Me too. What's your mobile number?
        ok: true
      - zh: 你几岁？
        en: How old are you (little one)?
        reply: 几岁？我不是小朋友！
        replyEn: 几岁? I'm not a little kid!
  - they: 一三九，八八八八，六二五一。你的呢？
    theyEn: 139 8888 6251. And yours?
    options:
      - zh: 我的是一三六，二零三四，五七九八。
        en: Mine is 136 2034 5798.
        ok: true
      - zh: 我二十岁。
        en: I'm twenty.
        reply: 哈哈，我问你的手机号！
        replyEn: Haha, I asked for your phone number!
  - they: 好，我给你打电话。
    theyEn: OK, I'll call you.
    options:
      - zh: 好，再见！
        en: Great, bye!
        ok: true
      - zh: 对不起。
        en: Sorry.
        reply: 没关系……为什么？
        replyEn: No problem… but why?
end: Your phone buzzes a minute later. 喂？
```

:::key
- 11–99 are built like sums: 二十一 = two ten one.
- 百 hundred, 千 thousand, 万 ten thousand; 零 fills gaps.
- 两 for "two of something", 二 for counting, digits and ordinals.
- Ages: 我二十岁, no 是. Ask children 几岁, adults 多大.
- 几 for small expected numbers; 多少 for any number. In phone numbers, 1 is often 幺 yāo.
:::
