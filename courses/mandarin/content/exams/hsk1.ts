import type { Paper } from './types';

export const HSK1: Paper = {
  id: 'hsk1-a',
  title: 'HSK 1 mock paper',
  level: 1,
  minutes: 35,
  sections: [
    {
      title: 'Listening, part 1',
      skill: 'listening',
      instructions: 'You will hear a word or phrase twice. Does it match the picture?',
      questions: [
        { type: 'tf', zh: '苹果', picture: '🍎', answer: true },
        { type: 'tf', zh: '猫', picture: '🐶', answer: false },
        { type: 'tf', zh: '下雨', picture: '🌧️', answer: true },
        { type: 'tf', zh: '飞机', picture: '🚆', answer: false },
        { type: 'tf', zh: '睡觉', picture: '😴', answer: true },
      ],
    },
    {
      title: 'Listening, part 2',
      skill: 'listening',
      instructions: 'You will hear a sentence twice. Choose the matching picture.',
      questions: [
        { type: 'pictures', zh: '我喜欢喝茶。', pictures: ['🍵', '🥛', '☕'], answer: 0 },
        { type: 'pictures', zh: '他在医院工作，他是医生。', pictures: ['👨‍🏫', '👨‍⚕️', '👨‍🍳'], answer: 1 },
        { type: 'pictures', zh: '今天很冷。', pictures: ['☀️', '🥶', '🌧️'], answer: 1 },
        { type: 'pictures', zh: '我们坐出租车去吧。', pictures: ['🚕', '🚌', '✈️'], answer: 0 },
        { type: 'pictures', zh: '桌子上有三本书。', pictures: ['📚', '🍎🍎🍎', '✏️'], answer: 0 },
      ],
    },
    {
      title: 'Listening, part 3',
      skill: 'listening',
      instructions: 'You will hear a short dialogue twice. Choose the matching picture.',
      questions: [
        { type: 'pictures', zh: '你想吃什么？——我想吃米饭。', pictures: ['🍚', '🍜', '🥟'], answer: 0 },
        { type: 'pictures', zh: '你在做什么？——我在看电视。', pictures: ['📺', '📖', '🎤'], answer: 0 },
        { type: 'pictures', zh: '你家有狗吗？——没有，我家有一只猫。', pictures: ['🐶', '🐱', '🐟'], answer: 1 },
        { type: 'pictures', zh: '你明天怎么去北京？——我坐飞机去。', pictures: ['🚆', '✈️', '🚗'], answer: 1 },
        { type: 'pictures', zh: '你要买什么？——我想买一件衣服。', pictures: ['👕', '📱', '🍎'], answer: 0 },
      ],
    },
    {
      title: 'Listening, part 4',
      skill: 'listening',
      instructions: 'You will hear a sentence and a question twice. Choose the answer.',
      questions: [
        { type: 'choose', zh: '我叫王小明，我是中国人。问：王小明是哪国人？', options: ['中国人', '美国人', '英国人'], answer: 0 },
        { type: 'choose', zh: '现在下午三点，我们五点去吃饭。问：他们几点吃饭？', options: ['三点', '四点', '五点'], answer: 2 },
        { type: 'choose', zh: '这个杯子二十块，那个杯子十块。问：那个杯子多少钱？', options: ['十块', '二十块', '三十块'], answer: 0 },
        { type: 'choose', zh: '我女儿今年八岁，她很喜欢唱歌。问：她女儿喜欢做什么？', options: ['看书', '唱歌', '睡觉'], answer: 1 },
        { type: 'choose', zh: '明天是星期六，我不上班。问：今天星期几？', options: ['星期五', '星期六', '星期天'], answer: 0 },
      ],
    },
    {
      title: 'Reading, part 1',
      skill: 'reading',
      instructions: 'Does the word match the picture?',
      questions: [
        { type: 'tf', zh: '电脑', picture: '💻', answer: true },
        { type: 'tf', zh: '火车', picture: '🚗', answer: false },
        { type: 'tf', zh: '米饭', picture: '🍚', answer: true },
        { type: 'tf', zh: '老师', picture: '👨‍🏫', answer: true },
        { type: 'tf', zh: '水果', picture: '🍞', answer: false },
      ],
    },
    {
      title: 'Reading, part 2',
      skill: 'reading',
      instructions: 'Choose the picture that matches the sentence.',
      questions: [
        { type: 'pictures', zh: '我的手机在桌子上。', pictures: ['📱', '💻', '📺'], answer: 0 },
        { type: 'pictures', zh: '妈妈在做饭。', pictures: ['🍳', '🛌', '🚗'], answer: 0 },
        { type: 'pictures', zh: '他很高兴。', pictures: ['😢', '😄', '😠'], answer: 1 },
        { type: 'pictures', zh: '小狗在椅子下面。', pictures: ['🐶', '🐱', '🐦'], answer: 0 },
        { type: 'pictures', zh: '今天天气很好，不冷也不热。', pictures: ['🌤️', '❄️', '⛈️'], answer: 0 },
      ],
    },
    {
      title: 'Reading, part 3',
      skill: 'reading',
      instructions: 'Choose the best reply.',
      questions: [
        { type: 'choose', zh: '你叫什么名字？', options: ['我叫李明。', '我很好。', '我是学生。'], answer: 0 },
        { type: 'choose', zh: '谢谢你！', options: ['不客气。', '没关系。', '再见。'], answer: 0 },
        { type: 'choose', zh: '你的书在哪儿？', options: ['在桌子上。', '三本。', '很好看。'], answer: 0 },
        { type: 'choose', zh: '这件衣服多少钱？', options: ['两百块。', '很漂亮。', '是我的。'], answer: 0 },
        { type: 'choose', zh: '对不起！', options: ['没关系。', '不客气。', '是吗？'], answer: 0 },
      ],
    },
    {
      title: 'Reading, part 4',
      skill: 'reading',
      instructions: 'Choose the word that fills the gap.',
      questions: [
        { type: 'fill', zh: '你___哪国人？', options: ['是', '在', '有'], answer: 0 },
        { type: 'fill', zh: '我家___四口人。', options: ['是', '有', '在'], answer: 1 },
        { type: 'fill', zh: '我们明天___吃饭吧。', options: ['一起', '什么', '多少'], answer: 0 },
        { type: 'fill', zh: '他___医院工作。', options: ['在', '是', '和'], answer: 0 },
        { type: 'fill', zh: '我想买两___书。', options: ['本', '个', '口'], answer: 0 },
      ],
    },
  ],
};
