import type { Paper } from './types';

export const HSK2: Paper = {
  id: 'hsk2-a',
  title: 'HSK 2 mock paper',
  level: 2,
  minutes: 45,
  sections: [
    {
      title: 'Listening, part 1',
      skill: 'listening',
      instructions: 'You will hear a sentence twice. Does it match the picture?',
      questions: [
        { type: 'tf', zh: '他每天早上都去跑步。', picture: '🏃', answer: true },
        { type: 'tf', zh: '我们一起去游泳吧。', picture: '⚽', answer: false },
        { type: 'tf', zh: '她正在洗手。', picture: '🧼', answer: true },
        { type: 'tf', zh: '外面下雪了，你多穿点儿衣服。', picture: '☀️', answer: false },
        { type: 'tf', zh: '这是我的新手表，很漂亮吧？', picture: '⌚', answer: true },
      ],
    },
    {
      title: 'Listening, part 2',
      skill: 'listening',
      instructions: 'You will hear a short dialogue twice. Choose the matching picture.',
      questions: [
        { type: 'pictures', zh: '你怎么了？——我头疼，想去医院看看。', pictures: ['🤕', '😄', '🍽️'], answer: 0 },
        { type: 'pictures', zh: '你喜欢什么运动？——我最喜欢打篮球。', pictures: ['⚽', '🏀', '🏊'], answer: 1 },
        { type: 'pictures', zh: '我们怎么去机场？——坐地铁吧，比打车快。', pictures: ['🚇', '🚕', '🚲'], answer: 0 },
        { type: 'pictures', zh: '生日快乐！这是送你的。——谢谢，是花吗？', pictures: ['💐', '🎂', '📚'], answer: 0 },
        { type: 'pictures', zh: '你在看什么？——我在网上看电影。', pictures: ['💻', '📖', '📺'], answer: 0 },
      ],
    },
    {
      title: 'Listening, part 3',
      skill: 'listening',
      instructions: 'You will hear a dialogue and a question twice. Choose the answer.',
      questions: [
        { type: 'choose', zh: '女：你去过上海吗？男：去过两次，我很喜欢那儿。问：男的去过几次上海？', options: ['一次', '两次', '没去过'], answer: 1 },
        { type: 'choose', zh: '男：从你家到公司远吗？女：不远，走路十分钟就到了。问：女的怎么去公司？', options: ['坐车', '走路', '跑步'], answer: 1 },
        { type: 'choose', zh: '女：这件红色的比黑色的贵多少？男：贵五十块。问：哪件衣服便宜？', options: ['红色的', '黑色的', '一样'], answer: 1 },
        { type: 'choose', zh: '男：你怎么没来上课？女：因为我生病了，所以在家休息。问：女的为什么没来？', options: ['她很忙', '她生病了', '她去旅游了'], answer: 1 },
        { type: 'choose', zh: '女：你汉语说得真好！男：哪里，我学了三年了。问：男的学了多长时间汉语？', options: ['一年', '两年', '三年'], answer: 2 },
        { type: 'choose', zh: '男：电影几点开始？女：七点半，现在已经七点二十了，快走吧！问：电影几点开始？', options: ['七点', '七点二十', '七点半'], answer: 2 },
      ],
    },
    {
      title: 'Reading, part 1',
      skill: 'reading',
      instructions: 'Choose the picture that matches the sentence.',
      questions: [
        { type: 'pictures', zh: '他已经吃完饭了，正在洗碗。', pictures: ['🍽️', '🛌', '🚗'], answer: 0 },
        { type: 'pictures', zh: '门开着，你进来吧。', pictures: ['🚪', '🪟', '🛏️'], answer: 0 },
        { type: 'pictures', zh: '我的眼睛有点儿疼，不想看书了。', pictures: ['👀', '🦶', '✋'], answer: 0 },
        { type: 'pictures', zh: '妹妹在画画，画得很好看。', pictures: ['🎨', '🎤', '⚽'], answer: 0 },
        { type: 'pictures', zh: '火车快要开了，我们快走吧！', pictures: ['🚆', '✈️', '🚢'], answer: 0 },
      ],
    },
    {
      title: 'Reading, part 2',
      skill: 'reading',
      instructions: 'Choose the word that fills the gap.',
      questions: [
        { type: 'fill', zh: '我___过北京烤鸭，非常好吃。', options: ['吃', '在', '着'], answer: 0 },
        { type: 'fill', zh: '我家___学校很近。', options: ['从', '离', '到'], answer: 1 },
        { type: 'fill', zh: '他跑___很快。', options: ['得', '的', '了'], answer: 0 },
        { type: 'fill', zh: '___今天下雨，所以我们不去公园了。', options: ['因为', '虽然', '但是'], answer: 0 },
        { type: 'fill', zh: '哥哥___我高十厘米。', options: ['比', '跟', '和'], answer: 0 },
      ],
    },
    {
      title: 'Reading, part 3',
      skill: 'reading',
      instructions: 'Read the passage and answer the question.',
      questions: [
        { type: 'choose', zh: '小王每天早上七点起床，七点半吃早饭，八点去公司。', question: '小王几点吃早饭？', options: ['七点', '七点半', '八点'], answer: 1 },
        { type: 'choose', zh: '我的爱好是游泳。我从小就喜欢游泳，现在每个星期都去两次。', question: '他多长时间去游一次泳？', options: ['每天', '一个星期两次', '一个月一次'], answer: 1 },
        { type: 'choose', zh: '这家饭馆的菜虽然有点儿贵，但是非常好吃，所以人很多。', question: '这家饭馆怎么样？', options: ['便宜，人不多', '贵，但是好吃', '不好吃'], answer: 1 },
        { type: 'choose', zh: '明天是姐姐的生日，我准备送她一本书，因为她最喜欢看书。', question: '他为什么送姐姐书？', options: ['姐姐喜欢看书', '书很便宜', '姐姐是老师'], answer: 0 },
        { type: 'choose', zh: '我们班有二十个学生，男生比女生多四个。', question: '班里有几个女生？', options: ['八个', '十二个', '十六个'], answer: 0 },
      ],
    },
    {
      title: 'Reading, part 4',
      skill: 'reading',
      instructions: 'Choose the best reply.',
      questions: [
        { type: 'choose', zh: '你吃饭了吗？', options: ['还没有，我们一起吃吧。', '我吃过。', '我不吃了吗。'], answer: 0 },
        { type: 'choose', zh: '你为什么学汉语？', options: ['因为我想去中国工作。', '我学了两年。', '汉语很难吗？'], answer: 0 },
        { type: 'choose', zh: '这个周末你有时间吗？', options: ['有，你有什么事？', '我没有手表。', '现在三点。'], answer: 0 },
        { type: 'choose', zh: '不好意思，我来晚了。', options: ['没关系，我们也刚到。', '不客气。', '你好。'], answer: 0 },
      ],
    },
  ],
};
