# 快速开始指南

## 1. 安装依赖

```bash
npm install
```

## 2. 编译 TypeScript

```bash
npm run build
```

这将编译 `index.ts` 生成可执行的 JavaScript 文件。

## 3. 准备数据

### 方式一：从现有 JSON 导出

如果你已经在使用 `awards_board.html`，可以：

1. 打开 `awards_board.html` 在浏览器中
2. 点击"导出数据"按钮
3. 保存为 `caucoj_awards.json`

### 方式二：手动创建 JSON

创建一个 `caucoj_awards.json` 文件：

```json
{
  "data": [
    {
      "username": "Alice",
      "studentInfo": "2021001 张三",
      "ojProblems": 150,
      "awards": [
        {
          "type": "ICPC-金奖",
          "contest": "2023 ICPC 亚洲区域赛",
          "date": "2023-11",
          "team": "CAU Team A",
          "liveRank": 5,
          "schoolRank": 1,
          "teammates": ["2021002 李四", "2021003 王五"]
        }
      ]
    }
  ],
  "weights": {
    "ICPC-金奖": 6.0,
    "ICPC-银奖": 4.0
  },
  "params": {
    "baseScore": 100,
    "decayFactor": 0.5
  }
}
```

## 4. 导入数据到 MongoDB

### 基本用法

```bash
node import_data.js caucoj_awards.json
```

### 自定义配置

使用环境变量自定义连接：

```bash
# Windows (PowerShell)
$env:MONGO_URL="mongodb://username:password@localhost:27017"
$env:DB_NAME="hydro"
$env:DOMAIN_ID="system"
node import_data.js caucoj_awards.json

# Linux/Mac
MONGO_URL="mongodb://username:password@localhost:27017" \
DB_NAME="hydro" \
DOMAIN_ID="system" \
node import_data.js caucoj_awards.json
```

### 使用 npm 脚本

```bash
npm run import caucoj_awards.json
```

## 5. 在 Hydro 中安装插件

### 方式一：本地开发模式

1. 将整个项目目录复制到 Hydro 的 `packages` 目录
2. 在 Hydro 配置文件中启用插件

### 方式二：发布到 npm

```bash
npm publish
```

然后在 Hydro 中安装：

```bash
hydrooj install @hydrooj/plugin-caucoj-rankboard
```

## 6. 验证安装

启动 Hydro 后：

1. 访问导航栏应该能看到"排名荣誉榜"入口（图标：🏆）
2. 访问 `/rankboard` 查看排名榜主页
3. 点击任意人员的"查看详情"查看详细信息

## 7. 数据结构说明

### 必填字段

- `username`: 用户名（字符串）
- `studentInfo`: 学号姓名（字符串）
- `awards`: 获奖数组

### awards 数组中每项必填

- `type`: 奖项类型（必须是配置中定义的类型之一）

### 可选字段

所有其他字段都是可选的，插件会自动处理空值：

- `ojProblems`: 默认为 0
- `contest`: 比赛名称
- `date`: 日期
- `team`: 队伍名称
- `liveRank`: 实时排名
- `schoolRank`: 学校排名
- `score`: 比赛分数
- `teammates`: 队友数组

## 8. 常见问题

### Q: 导入数据时提示连接失败

A: 检查 MongoDB 是否正在运行，以及连接 URL 是否正确。

### Q: 数据导入成功但页面显示为空

A: 检查 `domainId` 是否与 Hydro 中的域ID一致。

### Q: 某些字段没有显示

A: 检查该字段是否存在于数据中，模板会自动隐藏空字段。

### Q: 如何更新权重配置

A: 重新运行导入脚本，或直接在 MongoDB 中修改 `rankboard.config` 集合。

### Q: 如何添加新的奖项类型

A: 在导入的 JSON 中的 `weights` 对象添加新类型及其权重即可。

## 9. 开发调试

### 查看数据库

```javascript
// 连接到 MongoDB
use hydro;

// 查看所有人员
db.getCollection('rankboard.people').find().pretty();

// 查看配置
db.getCollection('rankboard.config').find().pretty();

// 统计数据
db.getCollection('rankboard.people').count();
```

### 修改模板

模板文件位于 `templates/` 目录：

- `rankboard_main.html` - 主页
- `rankboard_detail.html` - 详情页

修改后需要重启 Hydro 服务。

### 调试日志

插件加载成功会在控制台输出：
```
CAU COJ Ranking Board Plugin loaded successfully
```

## 10. 下一步

- 自定义样式和主题
- 添加数据管理界面
- 实现数据导出功能
- 添加统计图表
- 支持多语言

## 技术支持

如有问题请联系 CAU COJ 团队。
