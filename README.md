# CAU COJ 排名荣誉榜插件

这是一个为 HydroOJ 开发的排名荣誉榜插件，用于展示 CAUCOJ 的获奖情况和积分排名。

## 功能特性

- 📊 基于获奖情况的综合积分排名系统
- 🏆 支持多种竞赛类型：ICPC、CCPC、PAT、天梯赛、百度之星等
- 👥 支持团队获奖和队友信息展示
- 📈 排名衰减算法（ICPC/CCPC）
- 🎨 美观的界面展示
- 📱 响应式设计

## 数据模型

### 人员数据 (PersonData)
```typescript
{
  _id: ObjectId,           // MongoDB ID
  username: string,        // 用户名
  studentInfo: string,     // 学号 姓名
  ojProblems: number,      // OJ 题目数
  awards: Award[]          // 获奖数组
}
```

### 奖项数据 (Award)
```typescript
{
  type: string,            // 奖项类型（必填）
  contest?: string,        // 比赛名称
  date?: string,          // 日期
  team?: string,          // 队伍名称
  liveRank?: number,      // 实时排名
  schoolRank?: number,    // 学校排名
  score?: number,         // 比赛分数
  teammates?: string[]    // 队友列表
}
```

### 配置数据 (RankBoardConfig)
```typescript
{
  weights: {              // 奖项权重
    [awardType: string]: number
  },
  params: {
    baseScore: number,    // 基础分数（默认 100）
    decayFactor: number   // 衰减系数（默认 0.5）
  }
}
```

## 支持的奖项类型

### ICPC 系列
- ICPC-金奖: 6.0
- ICPC-银奖: 4.0
- ICPC-铜奖: 2.0
- ICPC-EC-金奖: 4.5
- ICPC-EC-银奖: 3.5
- ICPC-EC-铜奖: 2.5

### CCPC 系列
- CCPC-金奖: 6.0
- CCPC-银奖: 4.0
- CCPC-铜奖: 2.0

### PAT 系列
- PAT顶级满分: 3.5
- PAT甲级满分: 2.5
- PAT乙级满分: 1.5

### 天梯赛系列
- 天梯赛-团队全国特等奖: 4.0
- 天梯赛-团队全国一等奖: 3.0
- 天梯赛-团队全国二等奖: 2.0
- 天梯赛-团队全国三等奖: 1.0
- 天梯赛-个人全国特等奖: 3.0
- 天梯赛-个人全国一等奖: 2.0
- 天梯赛-个人全国二等奖: 1.0
- 天梯赛-个人全国三等奖: 0.5

### 其他
- 百度之星-金奖: 3.0
- 百度之星-银奖: 2.0
- 百度之星-铜奖: 1.0

## 积分计算规则

1. **基础积分**: `权重 × 基础分数(100)`

2. **ICPC/CCPC 排名衰减**: 
   ```
   最终权重 = 基础权重 × (衰减系数 ^ (排名 - 1))
   ```
   例如：ICPC金奖基础权重6.0，排名第3
   ```
   最终权重 = 6.0 × (0.5 ^ 2) = 1.5
   最终积分 = 1.5 × 100 = 150
   ```

3. **总分**: 所有获奖积分之和

## 安装方法

1. 将插件文件放置到 Hydro 插件目录
2. 编译 TypeScript:
   ```bash
   npm install
   npx tsc
   ```
3. 在 Hydro 配置中启用插件
4. 重启 Hydro 服务

## 数据导入

### 从 JSON 文件导入

创建数据导入脚本 `import_data.js`:

```javascript
const { MongoClient } = require('mongodb');
const fs = require('fs');

async function importData() {
  const client = await MongoClient.connect('mongodb://localhost:27017');
  const db = client.db('hydro');
  
  // 读取导出的 JSON 数据
  const jsonData = JSON.parse(fs.readFileSync('caucoj_awards.json', 'utf8'));
  
  const domainId = 'system'; // 或您的域ID
  
  // 导入人员数据
  const peopleCol = db.collection('rankboard.people');
  for (const person of jsonData.data) {
    await peopleCol.updateOne(
      { domainId, studentInfo: person.studentInfo },
      { $set: { ...person, domainId } },
      { upsert: true }
    );
  }
  
  // 导入配置
  const configCol = db.collection('rankboard.config');
  await configCol.updateOne(
    { domainId },
    { $set: { 
      domainId,
      weights: jsonData.weights || {},
      params: jsonData.params || { baseScore: 100, decayFactor: 0.5 }
    }},
    { upsert: true }
  );
  
  console.log('数据导入完成！');
  await client.close();
}

importData().catch(console.error);
```

运行导入脚本:
```bash
node import_data.js
```

### 手动添加数据

通过 MongoDB 直接插入:

```javascript
// 连接到 MongoDB
use hydro;

// 插入人员数据
db.getCollection('rankboard.people').insertOne({
  domainId: 'system',
  username: '张三',
  studentInfo: '2021001 张三',
  ojProblems: 150,
  awards: [
    {
      type: 'ICPC-金奖',
      contest: '2023 ICPC 亚洲区域赛',
      date: '2023-11',
      team: 'CAU Team A',
      liveRank: 5,
      schoolRank: 1,
      teammates: ['2021002 李四', '2021003 王五']
    }
  ]
});
```

## 路由说明

- `/rankboard` - 排名榜主页
- `/rankboard/:uid` - 人员详情页

## 模板文件

- `templates/rankboard_main.html` - 主页模板
- `templates/rankboard_detail.html` - 详情页模板

## 数据库集合

- `rankboard.people` - 存储人员和获奖数据
- `rankboard.config` - 存储权重和参数配置

## 字段处理说明

所有可选字段都已做好空值处理：
- `ojProblems`: 默认为 0
- `awards`: 默认为空数组 []
- `contest, date, team, liveRank, schoolRank, score, teammates`: 在模板中使用条件渲染

## 开发说明

### 目录结构
```
CAUCOJRankBoard/
├── index.ts              # 插件主文件
├── package.json          # 包配置
├── tsconfig.json         # TypeScript 配置
├── templates/            # Nunjucks 模板
│   ├── rankboard_main.html
│   └── rankboard_detail.html
└── README.md            # 本文档
```

### 技术栈
- TypeScript
- HydroOJ Framework
- MongoDB
- Nunjucks Template Engine

## 许可证

MIT License

## 作者

CAU COJ Team
