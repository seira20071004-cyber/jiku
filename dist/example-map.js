export const exampleMap = {
  name: '幸せな人生',
  branches: [
    {
      name: '健康', purpose: '元気に過ごせる日を増やす',
      goals: [
        {name: '体を動かす習慣をつくる', tasks: [
          ['10分歩く', 10, 30, 'rest'],
          ['自重トレーニングをする', 20, 40, 'full']
        ]},
        {name: '睡眠と食事を整える', tasks: [
          ['寝る前に5分ストレッチする', 5, 25, 'rest'],
          ['明日の食事を準備する', 15, 45, 'busy']
        ]}
      ]
    },
    {
      name: '優秀なエンジニアになる', purpose: 'アイデアを使える形にできる力をつける',
      goals: [
        {name: '個人開発を進める', tasks: [
          ['小さな機能をひとつ実装する', 45, 90, 'full'],
          ['画面の使いにくい箇所を直す', 20, 40, 'busy']
        ]},
        {name: '技術の基礎を固める', tasks: [
          ['公式ドキュメントを読む', 15, 45, 'busy'],
          ['読んだ内容をサンプルコードで試す', 25, 50, 'full']
        ]}
      ]
    },
    {
      name: '人間関係', purpose: '大切な人と話す時間を増やす',
      goals: [
        {name: '家族や友人とつながる', tasks: [
          ['気になっていた人に連絡する', 5, 15, 'rest'],
          ['家族や友人と近況を話す', 20, 40, 'busy']
        ]},
        {name: '新しいつながりをつくる', tasks: [
          ['興味のある勉強会を探す', 15, 15, 'busy'],
          ['コミュニティで質問に答える', 15, 30, 'full']
        ]}
      ]
    },
    {
      name: '英語', purpose: '英語で話したり、情報を得たりできるようになる',
      goals: [
        {name: '会話に慣れる', tasks: [
          ['10分シャドーイングする', 10, 30, 'busy'],
          ['英会話で今日の出来事を話す', 25, 50, 'full']
        ]},
        {name: '語彙と読解を伸ばす', tasks: [
          ['英単語を10個復習する', 5, 25, 'rest'],
          ['短い英語記事を1本読む', 15, 45, 'busy']
        ]}
      ]
    }
  ]
};

const health = exampleMap.branches[0];
const [task, daily, weekly] = health.goals[0].tasks[0];
export const starterMap = {name: exampleMap.name, galaxy: health.name, task, daily: String(daily), weekly: String(weekly)};

export function createExampleDraft() {
  return {
    name: exampleMap.name,
    children: exampleMap.branches.map(branch => ({
      name: branch.name,
      kind: 'goal',
      purpose: branch.purpose,
      children: branch.goals.map(goal => ({
        name: goal.name,
        kind: 'goal',
        purpose: branch.purpose,
        children: goal.tasks.map(([name, daily, weekly, mode]) => ({
          name, kind: 'action', purpose: goal.name, daily, weekly, mode
        }))
      }))
    }))
  };
}
