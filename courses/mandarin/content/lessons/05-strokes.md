---
title: Strokes, order and radicals
goals:
  - name the basic strokes that every character is made of
  - follow the rules of stroke order, and write characters stroke by stroke
  - use radicals to group characters and guess their meaning
---

Do you need to write Chinese by hand? Honestly, less than you might think. People type Chinese by typing pinyin and choosing characters from a list, and HSK 1 and 2 test reading and listening, not handwriting.

So why this lesson? Because writing a character a few times is the fastest way to **see** it properly. Your eye stops seeing a blob and starts seeing parts: the 女 in 好, the 氵 in 河. And stroke order is not arbitrary: it is the rhythm that makes characters quick to write and easy to read. Ten minutes here will make every character after this easier to remember.

## Eight strokes build everything

Every character is made from a small set of basic strokes. Here are the main ones, as they appear in 永 yǒng (eternal), a character calligraphers practise because it contains nearly all of them:

| Stroke | Name | Direction | Example |
| --- | --- | --- | --- |
| 丶 | diǎn, dot | short, down-right | the top of 六 |
| 一 | héng, horizontal | left to right | 一, 二, 三 |
| 丨 | shù, vertical | top to bottom | 十, 中 |
| 丿 | piě, left-falling | top-right to bottom-left | the left leg of 人 |
| ㇏ | nà, right-falling | top-left to bottom-right, thickening | the right leg of 人 |
| ㇀ | tí, rising | bottom-left to top-right | the bottom of 我's left part |
| 亅 | gōu, hook | a stroke ending in a flick | 小, 子 |
| ㇕ | zhé, turn | a stroke that changes direction | 口, 日 |

Watch a few being written:

::stroke-player{chars="一二三十人大"}

## The rules of order

Stroke order follows a few rules, which work for the vast majority of characters:

1. **Top before bottom**: 三 is written from the top line down.
2. **Left before right**: 你 starts with 亻.
3. **Horizontal before vertical when they cross**: 十 is 一 then 丨.
4. **Left-falling before right-falling**: 人 is 丿 then ㇏.
5. **Outside before inside, then close the door**: in 日 and 口, the frame first, the inside next, the bottom line last.
6. **Middle before the sides** when the sides are small: 小 is the hook, then left dot, then right dot.

::stroke-player{chars="口日中小月"}

:::tip
You don't need to memorise these rules as rules. Watch each new character animated once, then write it twice with your finger. Within a week your hand will start predicting the order by itself.
:::

Now you write. Draw each stroke in order. If you get stuck, three misses show a hint.

```write
title: Your first characters
chars: 人大口中
```

```choose
title: Which comes first?
items:
  - prompt: In 十, which stroke do you write first?
    zh: 十
    options: [The horizontal 一, The vertical 丨]
    answer: 0
    explain: Horizontal before vertical when they cross.
  - prompt: In 日, which stroke comes **last**?
    zh: 日
    options: [The left side, The middle line, The bottom line]
    answer: 2
    explain: Outside, then inside, then close the door at the bottom.
  - prompt: In 你, what do you write first?
    zh: 你
    options: [亻 on the left, 尔 on the right]
    answer: 0
    explain: Left before right.
```

## Radicals: how dictionaries sort characters

Paper dictionaries cannot sort characters alphabetically, so they group them by a shared component, the **radical** (部首 bùshǒu), usually the meaning part you met in the last lesson. There are about 200, but a couple of dozen cover most common characters.

Learning the main radicals pays off twice: they tell you roughly what a character is about, and they turn complicated characters into a few familiar chunks. 谢 (thank) is not fifteen random strokes: it is 讠 speech + 身 body + 寸 inch.

::radical-explorer

```sort
title: Which radical?
prompt: Sort each character by its meaning radical.
buckets: [氵 water, 口 mouth, 女 woman, 木 tree]
items:
  - [河, 0]
  - [海, 0]
  - [喝, 1]
  - [吃, 1]
  - [姐, 2]
  - [妹, 2]
  - [林, 3]
  - [树, 3]
  - [汤, 0]
  - [叫, 1]
explain: 喝 (to drink) takes the mouth, not water. Radicals tell you what something is about, not always the obvious category.
```

```write
title: Characters with a radical
chars: 好妈明休
```

```words
一 | one
二 | two
三 | three
十 | ten
小 | small, little
中 | middle; China
好 | good
你 | you
```

:::culture
Handwriting still matters in China, even in the age of phones. Children spend years copying characters into exercise books with grids like the one above (田字格, "field-character grid"), and there is a word for forgetting how to write a character you can read: 提笔忘字, "pick up the pen, forget the character". It happens to native speakers too, so don't feel bad when it happens to you.
:::

:::key
- Characters are built from a few basic strokes, written in a predictable order: top to bottom, left to right, outside before inside.
- Radicals are the meaning parts that group characters; learning the common ones makes new characters easier to remember.
- Writing a character a few times helps you see its parts, even if you mostly type.
:::

You now have the foundations: the sounds, the tones, and how characters work. Time to start talking.
