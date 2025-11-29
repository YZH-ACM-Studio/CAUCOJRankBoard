import {
  Context,
  db,
  Handler,
  ObjectId,
  param,
  PRIV,
  Types,
  UserModel,
} from 'hydrooj';

declare module 'hydrooj' {
  interface Collections {
    'rankboard.people': any;
    'rankboard.config': any;
  }
}

// 定义数据类型
interface Award {
  type: string;
  contest?: string;
  date?: string;
  team?: string;
  liveRank?: number;
  schoolRank?: number;
  score?: number;
  teammates?: string[];
  imageUrls?: string[];  // 团队图片URL列表（支持多张）
}

interface PersonData {
  _id?: ObjectId;
  username: string;
  studentInfo: string;
  ojProblems: number;
  awards: Award[];
  userId?: number;  // 添加用户ID字段
  uname?: string;   // 添加真实用户名字段
  employmentStatus?: string;  // 就业去向
}

interface AwardWeights {
  [key: string]: number;
}

interface RankBoardConfig {
  weights: AwardWeights;
  bounds?: any;
  params?: {
    baseScore: number;
    decayFactor: number;
  };
}

// 数据库集合
const collPeople = db.collection('rankboard.people');
const collConfig = db.collection('rankboard.config');

// 排名榜数据模型
namespace RankBoardModel {
  // 获取所有人员数据
  export async function getAllPeople(domainId: string): Promise<PersonData[]> {
    return await collPeople.find({ domainId }).toArray() as PersonData[];
  }

  // 获取配置
  export async function getConfig(domainId: string): Promise<RankBoardConfig> {
    const config = await collConfig.findOne({ domainId });
    if (!config) {
      // 返回默认配置
      return {
        weights: {
          'ICPC-金奖': 6.0,
          'ICPC-银奖': 4.0,
          'ICPC-铜奖': 2.0,
          'ICPC-EC-金奖': 4.5,
          'ICPC-EC-银奖': 3.5,
          'ICPC-EC-铜奖': 2.5,
          'CCPC-金奖': 6.0,
          'CCPC-银奖': 4.0,
          'CCPC-铜奖': 2.0,
          '百度之星-金奖': 3.0,
          '百度之星-银奖': 2.0,
          '百度之星-铜奖': 1.0,
          'PAT顶级满分': 3.5,
          'PAT甲级满分': 2.5,
          'PAT乙级满分': 1.5,
          '天梯赛-团队全国特等奖': 4.0,
          '天梯赛-团队全国一等奖': 3.0,
          '天梯赛-团队全国二等奖': 2.0,
          '天梯赛-团队全国三等奖': 1.0,
          '天梯赛-个人全国特等奖': 3.0,
          '天梯赛-个人全国一等奖': 2.0,
          '天梯赛-个人全国二等奖': 1.0,
          '天梯赛-个人全国三等奖': 0.5,
        },
        params: {
          baseScore: 100,
          decayFactor: 0.5,
        },
      };
    }
    return config as RankBoardConfig;
  }

  // 更新配置
  export async function updateConfig(
    domainId: string,
    config: RankBoardConfig
  ): Promise<void> {
    await collConfig.updateOne(
      { domainId },
      { $set: { ...config, domainId } },
      { upsert: true }
    );
  }

  // 添加或更新人员
  export async function upsertPerson(
    domainId: string,
    personData: PersonData
  ): Promise<void> {
    const { _id, ...data } = personData;
    if (_id) {
      await collPeople.updateOne(
        { _id, domainId },
        { $set: { ...data, domainId } }
      );
    } else {
      await collPeople.insertOne({ ...data, domainId });
    }
  }

  // 删除人员
  export async function deletePerson(
    domainId: string,
    personId: ObjectId
  ): Promise<void> {
    await collPeople.deleteOne({ _id: personId, domainId });
  }
}

// 排名榜主页处理器
class RankBoardMainHandler extends Handler {
  async get() {
    // 检查登录状态，未登录则跳转到首页
    if (!this.user._id || this.user._id === 0) {
      this.response.redirect = '/';
      return;
    }
    
    const domainId = this.domain._id;
    
    console.log('主页获取数据，domainId:', domainId);
    
    // 获取人员数据和配置
    const [people, config] = await Promise.all([
      RankBoardModel.getAllPeople(domainId),
      RankBoardModel.getConfig(domainId),
    ]);
    
    console.log('获取到的人员数量:', people.length);
    
    // 匹配用户信息
    const peopleWithUserInfo = await Promise.all(
      people.map(async (person) => {
        // 从 studentInfo 解析学号和姓名
        // 格式: "学号 姓名" 或 "学号  姓名"
        const match = person.studentInfo.trim().match(/^(\d+)\s+(.+)$/);
        
        if (match) {
          const studentId = match[1];
          const realName = match[2];
          
          // 查询 user 表
          const user = await db.collection('user').findOne({
            studentId: studentId,
            realName: realName,
          });
          
          if (user) {
            console.log(`找到用户匹配: ${studentId} ${realName} -> ${user.uname} (${user._id})`);
            return {
              ...person,
              userId: user._id,
              uname: user.uname,
            };
          } else {
            console.log(`未找到用户匹配: ${studentId} ${realName}`);
          }
        } else {
          console.log(`无法解析 studentInfo: ${person.studentInfo}`);
        }
        
        // 如果找不到用户，显示为 "User" 且不可点击
        return {
          ...person,
          userId: null,
          uname: 'User',
        };
      })
    );

    // 计算分数并排序
    const peopleWithScores = peopleWithUserInfo.map((person) => {
      let totalScore = 0;
      let baseScore = 0;
      const awards = person.awards || [];
      
      // 统计各类奖项数量
      const stats: any = {
        ladder_team_1: 0,
        ladder_team_2: 0,
        ladder_team_3: 0,
        ladder_individual_1: 0,
        ladder_individual_2: 0,
        ladder_individual_3: 0,
        icpc_gold: 0,
        icpc_silver: 0,
        icpc_bronze: 0,
        ccpc_gold: 0,
        ccpc_silver: 0,
        ccpc_bronze: 0,
        baidu_gold: 0,
        baidu_silver: 0,
        baidu_bronze: 0,
        pat_top: 0,
        pat_a: 0,
        pat_b: 0,
      };

      awards.forEach((award) => {
        const baseWeight = config.weights[award.type] || 1.0;
        let weight = baseWeight;

        // ICPC/CCPC 排名衰减
        if (award.type.startsWith('ICPC') || award.type.startsWith('CCPC')) {
          if (award.liveRank && award.liveRank > 0) {
            weight *= Math.pow(
              config.params?.decayFactor || 0.5,
              award.liveRank - 1
            );
          }
        }

        const score = weight * (config.params?.baseScore || 100);
        totalScore += score;
        
        // 统计各类奖项
        if (award.type.includes('天梯赛-团队')) {
          if (award.type.includes('一等奖') || award.type.includes('特等奖')) stats.ladder_team_1++;
          else if (award.type.includes('二等奖')) stats.ladder_team_2++;
          else if (award.type.includes('三等奖')) stats.ladder_team_3++;
        } else if (award.type.includes('天梯赛-个人')) {
          if (award.type.includes('一等奖') || award.type.includes('特等奖')) stats.ladder_individual_1++;
          else if (award.type.includes('二等奖')) stats.ladder_individual_2++;
          else if (award.type.includes('三等奖')) stats.ladder_individual_3++;
        } else if (award.type.startsWith('ICPC')) {
          if (award.type.includes('金奖')) stats.icpc_gold++;
          else if (award.type.includes('银奖')) stats.icpc_silver++;
          else if (award.type.includes('铜奖')) stats.icpc_bronze++;
        } else if (award.type.startsWith('CCPC')) {
          if (award.type.includes('金奖')) stats.ccpc_gold++;
          else if (award.type.includes('银奖')) stats.ccpc_silver++;
          else if (award.type.includes('铜奖')) stats.ccpc_bronze++;
        } else if (award.type.includes('百度之星')) {
          if (award.type.includes('金奖')) stats.baidu_gold++;
          else if (award.type.includes('银奖')) stats.baidu_silver++;
          else if (award.type.includes('铜奖')) stats.baidu_bronze++;
        } else if (award.type.includes('PAT')) {
          if (award.type.includes('顶级')) stats.pat_top++;
          else if (award.type.includes('甲级')) stats.pat_a++;
          else if (award.type.includes('乙级')) stats.pat_b++;
        }
      });
      
      // 计算基准分 (OJ题数 * 0.1)
      baseScore = (person.ojProblems || 0) * 0.1;

      return {
        ...person,
        totalScore,
        baseScore,
        awardCount: awards.length,
        stats,
      };
    });

    // 按分数排序
    peopleWithScores.sort((a, b) => b.totalScore - a.totalScore);

    // 添加排名
    peopleWithScores.forEach((person, index) => {
      (person as any).rank = index + 1;
    });
    
    // 检查用户是否有编辑权限
    const canManage = this.user.hasPriv(PRIV.PRIV_EDIT_SYSTEM);

    this.response.template = 'rankboard_main.html';
    this.response.body = {
      people: peopleWithScores,
      config,
      canManage,
      page_name: 'rankboard_main',
    };
  }
}

// 排名榜详情API处理器（返回JSON）
class RankBoardDetailHandler extends Handler {
  async get({ uid }: { uid: string }) {
    const domainId = this.domain._id;
    const person = await collPeople.findOne({ _id: new ObjectId(uid), domainId });
    if (!person) {
      this.response.body = { error: 'Person not found' };
      return;
    }

    const config = await RankBoardModel.getConfig(domainId);

    // 计算每个奖项的分数
    const awardsWithScores = (person.awards || []).map((award: Award) => {
      const baseWeight = config.weights[award.type] || 1.0;
      let weight = baseWeight;

      if (award.type.startsWith('ICPC') || award.type.startsWith('CCPC')) {
        if (award.liveRank && award.liveRank > 0) {
          weight *= Math.pow(
            config.params?.decayFactor || 0.5,
            award.liveRank - 1
          );
        }
      }

      return {
        ...award,
        score: weight * (config.params?.baseScore || 100),
        weight: baseWeight,
      };
    });

    this.response.body = {
      person: {
        ...person,
        awards: awardsWithScores,
      },
    };
  }
}

// 管理界面处理器
class RankBoardManageHandler extends Handler {
  async get() {
    const domainId = this.domain._id;
    const people = await RankBoardModel.getAllPeople(domainId);
    const config = await RankBoardModel.getConfig(domainId);
    
    this.response.template = 'rankboard_manage.html';
    this.response.body = {
      people,
      config,
      page_name: 'rankboard_manage',
    };
  }
  
  async post() {
    const domainId = this.domain._id;
    
    try {
      const { action, people, config } = this.request.body;
      
      // 处理配置更新请求
      if (action === 'updateConfig') {
        console.log('收到配置更新请求，domainId:', domainId);
        console.log('配置数据:', config);
        
        if (!config) {
          this.response.body = { 
            success: false, 
            error: '无效的配置数据'
          };
          return;
        }
        
        // 更新配置
        await RankBoardModel.updateConfig(domainId, config);
        
        this.response.body = { success: true, message: '配置已保存！' };
        return;
      }
      
      // 处理人员数据保存请求 (默认行为)
      console.log('收到保存请求，domainId:', domainId);
      console.log('people 数据类型:', typeof people);
      console.log('people 是否为数组:', Array.isArray(people));
      console.log('people 长度:', people ? people.length : 'null');
      
      if (!people || !Array.isArray(people)) {
        this.response.body = { 
          success: false, 
          error: '无效的数据格式，收到的数据类型: ' + typeof people
        };
        return;
      }
      
      // 清空现有数据
      const deleteResult = await collPeople.deleteMany({ domainId });
      console.log('删除了', deleteResult.deletedCount, '条旧数据');
      
      // 插入新数据并匹配用户
      if (people.length > 0) {
        // 为每个人员匹配用户信息
        const documentsToInsert = await Promise.all(
          people.map(async (p) => {
            let userId: number | null = null;
            let uname: string = 'User';
            
            // 从 studentInfo 解析学号和姓名
            const match = p.studentInfo.trim().match(/^(\d+)\s+(.+)$/);
            
            if (match) {
              const studentId = match[1];
              const realName = match[2];
              
              // 查询 user 表
              const user = await db.collection('user').findOne({
                studentId: studentId,
                realName: realName,
              });
              
              if (user) {
                console.log(`保存时找到用户匹配: ${studentId} ${realName} -> ${user.uname} (${user._id})`);
                userId = user._id;
                uname = user.uname;
              } else {
                console.log(`保存时未找到用户匹配: ${studentId} ${realName}，设置为 User`);
              }
            }
            
            return {
              ...p,
              domainId,
              ojProblems: p.ojProblems || 0,
              awards: p.awards || [],
              employmentStatus: p.employmentStatus || '',
              userId,
              uname,
            };
          })
        );
        
        const insertResult = await collPeople.insertMany(documentsToInsert);
        console.log('插入了', insertResult.insertedCount, '条新数据');
      }
      
      this.response.body = { success: true, message: `成功保存 ${people.length} 条记录！` };
    } catch (error) {
      console.error('保存数据失败:', error);
      this.response.body = { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// 插件导出
export function apply(ctx: Context) {
  // 注册路由
  ctx.Route('rankboard_main', '/rankboard', RankBoardMainHandler);
  ctx.Route(
    'rankboard_detail',
    '/rankboard/:uid/detail',
    RankBoardDetailHandler
  );
  ctx.Route(
    'rankboard_manage',
    '/rankboard/manage',
    RankBoardManageHandler,
    PRIV.PRIV_EDIT_SYSTEM
  );

  // 添加到导航栏（仅登录用户可见）
  ctx.injectUI('Nav', 'rankboard_main', { prefix: 'trophy' }, PRIV.PRIV_USER_PROFILE);

  // 国际化
  ctx.i18n.load('zh', {
    rankboard_main: '排名荣誉榜',
    'Awards Ranking Board': '排名荣誉榜',
    'Total Score': '总分',
    'Award Count': '获奖数量',
    'Rank': '排名',
    'Student Info': '学生信息',
    'OJ Problems': 'OJ题目数',
    'Awards': '获奖情况',
    'Award Type': '奖项类型',
    'Contest': '比赛名称',
    'Date': '日期',
    'Team': '队伍名称',
    'Live Rank': '实时排名',
    'School Rank': '学校排名',
    'Score': '分数',
    'Teammates': '队友',
    'Weight': '权重',
  });

  ctx.i18n.load('en', {
    rankboard_main: 'Awards Ranking Board',
  });

  // 初始化数据库索引
  collPeople.createIndex({ domainId: 1 });
  collConfig.createIndex({ domainId: 1 });

  console.log('CAUCOJ Ranking Board Plugin loaded successfully');
}
